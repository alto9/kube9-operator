#!/usr/bin/env node

/**
 * Create a GitHub issue or sub-issue using gh CLI.
 * Uses gh api for creation (to get issue id for sub-issue linking).
 */

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getRepoPath, parseIssueRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @deprecated Use parseIssueRef from gh-utils */
export function parseParentRef(ref, defaultRepoPath) {
  return parseIssueRef(ref, defaultRepoPath);
}

/** Parse argv. Returns { title, body, parentRef } or null. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 3) return null;
  const title = argv[2];
  if (!title || typeof title !== "string" || !title.trim()) return null;

  let body = "";
  let parentRef = null;
  const parentIdx = argv.indexOf("--parent");

  if (parentIdx !== -1 && argv[parentIdx + 1] != null) {
    parentRef = argv[parentIdx + 1];
  }
  const bodyEnd = parentIdx !== -1 ? parentIdx : argv.length;
  if (bodyEnd > 3) {
    body = argv.slice(3, bodyEnd).join(" ").trim();
  }
  return { title: title.trim(), body, parentRef };
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error("Usage: gh-create-issue.js <title> [body] [--parent <parent-ref>]");
    console.error("  title: Issue title");
    console.error("  body: Optional description (space-separated words)");
    console.error("  --parent: Create as sub-issue; parent-ref: issue number, owner/repo#123, or full URL");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  if (!repoPath) {
    console.error("Error: .forge/project.json not found or missing github_url");
    process.exit(1);
  }

  const payload = JSON.stringify({
    title: parsed.title,
    body: parsed.body || undefined,
  });

  const createResult = gh(
    ["api", "--method", "POST", `repos/${repoPath}/issues`, "--input", "-"],
    payload
  );
  let issue;
  try {
    issue = JSON.parse(createResult);
  } catch {
    console.error("Error: failed to parse gh response");
    process.exit(1);
  }

  const issueNumber = issue.number;
  const issueId = issue.id;

  if (parsed.parentRef) {
    const parent = parseIssueRef(parsed.parentRef, repoPath);
    if (!parent) {
      console.error(`Error: could not parse parent ref '${parsed.parentRef}'`);
      process.exit(1);
    }
    const subPayload = JSON.stringify({ sub_issue_id: issueId });
    try {
      gh(
        [
          "api",
          "--method",
          "POST",
          `repos/${parent.owner}/${parent.repo}/issues/${parent.issueNumber}/sub_issues`,
          "--input",
          "-",
        ],
        subPayload
      );
    } catch (err) {
      console.error(`Error: created issue #${issueNumber} but failed to link as sub-issue: ${err.message}`);
      process.exit(1);
    }
    console.log(`Sub-issue created: #${issueNumber}`);
  } else {
    console.log(`Issue created: #${issueNumber}`);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
