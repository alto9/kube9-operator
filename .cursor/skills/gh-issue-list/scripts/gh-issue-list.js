#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parse args: [state] [limit]. */
export function parseArgs(argv) {
  const state = (argv[2] ?? "open").trim() || "open";
  const limit = parseInt(argv[3] ?? "100", 10) || 100;
  return { state, limit };
}

function main() {
  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  if (!repoPath) {
    console.error("Error: .forge/project.json not found");
    process.exit(1);
  }

  const { state, limit } = parseArgs(process.argv);
  const out = gh([
    "issue",
    "list",
    "--repo",
    repoPath,
    "--state",
    state,
    "--limit",
    String(limit),
    "--json",
    "number,title,state,labels,assignees,url",
  ]);
  console.log(out);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
