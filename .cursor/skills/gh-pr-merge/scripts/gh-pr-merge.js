#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parsePrRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parse strategy: merge|squash|rebase. Default squash. */
export function parseStrategy(s) {
  const v = (s ?? "squash").trim().toLowerCase();
  if (["merge", "squash", "rebase"].includes(v)) return v;
  return null;
}

function main() {
  const prRef = process.argv[2];
  const strategyArg = process.argv[3];
  if (!prRef) {
    console.error("Usage: gh-pr-merge.js <pr-ref> [merge|squash|rebase]");
    console.error("  pr-ref: GitHub PR URL, owner/repo#123, or PR number");
    process.exit(1);
  }

  const strategy = parseStrategy(strategyArg);
  if (!strategy) {
    console.error("Error: merge strategy must be one of merge|squash|rebase");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  const parsed = parsePrRef(prRef, repoPath);
  if (!parsed) {
    console.error(`Error: could not parse PR ref '${prRef}'`);
    process.exit(1);
  }
  if (!parsed.owner || !parsed.repo) {
    console.error("Error: could not determine repo from .forge/project.json. Use owner/repo#123 or full URL.");
    process.exit(1);
  }

  const mergeFlag = strategy === "merge" ? "--merge" : strategy === "rebase" ? "--rebase" : "--squash";
  gh(["pr", "merge", String(parsed.prNumber), "--repo", `${parsed.owner}/${parsed.repo}`, mergeFlag]);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
