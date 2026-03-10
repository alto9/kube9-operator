#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parseIssueRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parse argv: issue-ref [--title ...] [--body ...] [--state ...]. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 3) return null;
  const issueRef = argv[2];
  let title = "";
  let body = "";
  let state = "";
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--title" && argv[i + 1] != null) {
      title = argv[i + 1];
      i++;
    } else if (argv[i] === "--body" && argv[i + 1] != null) {
      body = argv[i + 1];
      i++;
    } else if (argv[i] === "--state" && argv[i + 1] != null) {
      state = argv[i + 1];
      i++;
    }
  }
  if (!title && !body && !state) return null;
  return { issueRef, title, body, state };
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error("Usage: gh-edit-issue.js <issue-ref> [--title \"...\"] [--body \"...\"] [--state open|closed]");
    console.error("  Provide at least one of --title, --body, --state");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  const resolved = parseIssueRef(parsed.issueRef, repoPath);
  if (!resolved) {
    console.error(`Error: could not parse issue ref '${parsed.issueRef}'`);
    process.exit(1);
  }

  const args = ["issue", "edit", String(resolved.issueNumber), "--repo", `${resolved.owner}/${resolved.repo}`];
  if (parsed.title) args.push("--title", parsed.title);
  if (parsed.body) args.push("--body", parsed.body);
  if (parsed.state) args.push("--state", parsed.state);

  gh(args);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
