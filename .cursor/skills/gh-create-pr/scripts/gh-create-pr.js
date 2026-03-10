#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, runGitCapture, runGit, getDefaultBranch } from "../../lib/git-utils.js";
import { gh } from "../../lib/gh-utils.js";

function hasRemoteBranch(projectRoot, branch) {
  try {
    const out = runGitCapture(["ls-remote", "--heads", "origin", branch], projectRoot);
    return out.length > 0;
  } catch {
    return false;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const baseBranchArg = process.argv[2];
  const projectRoot = resolveProjectRoot(__dirname);

  let currentBranch = "";
  try {
    currentBranch = runGitCapture(["rev-parse", "--abbrev-ref", "HEAD"], projectRoot);
  } catch {
    console.error("Error: could not determine current branch.");
    process.exit(1);
  }
  if (!currentBranch || currentBranch === "HEAD") {
    console.error("Error: could not determine current branch.");
    process.exit(1);
  }

  let baseBranch = baseBranchArg?.trim();
  if (!baseBranch) {
    baseBranch = getDefaultBranch(projectRoot);
  }
  if (!baseBranch) baseBranch = "main";

  if (!hasRemoteBranch(projectRoot, currentBranch)) {
    runGit(["push", "-u", "origin", currentBranch], projectRoot);
  }

  gh(["pr", "create", "--base", baseBranch, "--head", currentBranch, "--fill"], undefined, {
    cwd: projectRoot,
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
