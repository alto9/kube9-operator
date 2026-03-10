#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parseIssueRef, gh } from "../../lib/gh-utils.js";
import { getDefaultBranch } from "../../lib/git-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: gh-get-issue.js <issue-ref>");
    console.error("  issue-ref: GitHub URL, owner/repo#123, or issue number");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  if (!repoPath) {
    console.error("Error: .forge/project.json not found");
    process.exit(1);
  }

  const parsed = parseIssueRef(arg, repoPath);
  if (!parsed) {
    console.error(`Error: could not parse issue ref '${arg}'`);
    process.exit(1);
  }

  const { owner, repo, issueNumber } = parsed;
  const repoSlug = `${owner}/${repo}`;

  let issueJson;
  try {
    const out = gh(["issue", "view", String(issueNumber), "--repo", repoSlug, "--json", "number,title,body,labels,state"]);
    issueJson = JSON.parse(out);
  } catch (err) {
    console.error(`Error: could not fetch issue ${issueNumber}`);
    process.exit(1);
  }

  let isSub = false;
  let parentNum = "";
  let parentTitle = "";
  let rootBranch = "main";

  try {
    const parentOut = gh(["api", `repos/${repoSlug}/issues/${issueNumber}/parent`]);
    const parent = JSON.parse(parentOut);
    isSub = true;
    parentNum = String(parent.number ?? "");
    parentTitle = parent.title ?? "";
    rootBranch = `feature/issue-${parentNum}`;
  } catch {
    // no parent
  }

  const defaultBranch = getDefaultBranch(projectRoot);
  if (!isSub) {
    rootBranch = defaultBranch;
  }

  const result = {
    ...issueJson,
    is_sub_issue: isSub,
    parent_number: parentNum,
    parent_title: parentTitle,
    root_branch: rootBranch,
  };
  console.log(JSON.stringify(result, null, 0));
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
