#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parsePrRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: gh-pr-checkout.js <pr-ref>");
    console.error("  pr-ref: GitHub PR URL, owner/repo#123, or PR number");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  const parsed = parsePrRef(arg, repoPath);
  if (!parsed) {
    console.error(`Error: could not parse PR ref '${arg}'`);
    process.exit(1);
  }
  if (!parsed.owner || !parsed.repo) {
    console.error("Error: could not determine repo from .forge/project.json. Use owner/repo#123 or full URL.");
    process.exit(1);
  }

  const repoSlug = `${parsed.owner}/${parsed.repo}`;
  gh(["pr", "checkout", String(parsed.prNumber), "--repo", repoSlug], undefined, { cwd: projectRoot });
  console.log(`Checked out PR #${parsed.prNumber}. Branch ready for review.`);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
