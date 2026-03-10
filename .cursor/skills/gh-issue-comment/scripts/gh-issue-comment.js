#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parseIssueRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const issueRef = process.argv[2];
  const comment = process.argv[3];
  if (!issueRef || !comment) {
    console.error("Usage: gh-issue-comment.js <issue-ref> <comment>");
    console.error("  issue-ref: GitHub URL, owner/repo#123, or issue number");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  const parsed = parseIssueRef(issueRef, repoPath);
  if (!parsed) {
    console.error(`Error: could not parse issue ref '${issueRef}'`);
    process.exit(1);
  }

  gh(
    ["issue", "comment", String(parsed.issueNumber), "--repo", `${parsed.owner}/${parsed.repo}`, "--body", comment]
  );
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
