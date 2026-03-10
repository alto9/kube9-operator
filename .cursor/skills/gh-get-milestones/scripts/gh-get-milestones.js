#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parse args: [state] [per_page]. */
export function parseArgs(argv) {
  const state = (argv[2] ?? "all").trim() || "all";
  const perPage = parseInt(argv[3] ?? "100", 10) || 100;
  return { state, perPage };
}

function main() {
  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  if (!repoPath) {
    console.error("Error: .forge/project.json not found");
    process.exit(1);
  }
  if (!repoPath.includes("/")) {
    console.error("Error: could not parse owner/repo from github_url");
    process.exit(1);
  }

  const { state, perPage } = parseArgs(process.argv);
  const out = gh(["api", `repos/${repoPath}/milestones?state=${state}&per_page=${perPage}`]);
  console.log(out);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
