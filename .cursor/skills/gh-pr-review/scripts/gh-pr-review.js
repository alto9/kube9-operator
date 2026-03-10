#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parsePrRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: gh-pr-review.js <pr-ref>");
    console.error("  pr-ref: GitHub PR URL, owner/repo#123, or PR number");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  const parsed = parsePrRef(arg, repoPath);
  if (!parsed) {
    console.error(`Error: could not parse PR reference '${arg}'`);
    process.exit(1);
  }

  const repoSlug = `${parsed.owner}/${parsed.repo}`;
  const out = gh(
    [
      "pr",
      "view",
      String(parsed.prNumber),
      "--repo",
      repoSlug,
      "--json",
      "number,title,url,state,mergeStateStatus,reviewDecision,headRefName,baseRefName,author,reviews,comments",
    ],
    undefined,
    { cwd: projectRoot }
  );
  console.log(out);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
