#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parse args: <title> [description] [due_date]. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 3) return null;
  const title = argv[2];
  if (!title || typeof title !== "string" || !title.trim()) return null;
  const description = (argv[3] ?? "").trim();
  const dueDate = (argv[4] ?? "").trim();
  return { title: title.trim(), description, dueDate };
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error("Usage: gh-create-milestone.js <title> [description] [due_date]");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  if (!repoPath) {
    console.error("Error: .forge/project.json not found");
    process.exit(1);
  }

  const payload = {
    title: parsed.title,
    description: parsed.description || undefined,
  };
  if (parsed.dueDate) {
    payload.due_on = parsed.dueDate + "T00:00:00Z";
  }

  gh(
    ["api", "--method", "POST", `repos/${repoPath}/milestones`, "--input", "-"],
    JSON.stringify(payload)
  );
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
