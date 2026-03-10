#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { resolveProjectRoot, getProjectConfig, getRepoPath, parseIssueRef, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Parse project URL to { owner, projectNumber }. Expects https://github.com/orgs/<owner>/projects/<number> or users/... */
export function parseProjectUrl(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.trim().match(/github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/i);
  return m ? { owner: m[1], projectNumber: m[2] } : null;
}

function main() {
  const issueRef = process.argv[2];
  const projectUrlArg = process.argv[3];
  if (!issueRef) {
    console.error("Usage: gh-project-item-add.js <issue-ref> [project-url]");
    console.error("  issue-ref: issue URL, owner/repo#123, or issue number");
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot(__dirname);
  const repoPath = getRepoPath(projectRoot);
  const parsed = parseIssueRef(issueRef, repoPath);
  if (!parsed) {
    console.error(`Error: could not parse issue ref '${issueRef}'`);
    process.exit(1);
  }

  const repoSlug = `${parsed.owner}/${parsed.repo}`;
  let issueUrl;
  try {
    const out = gh(["issue", "view", String(parsed.issueNumber), "--repo", repoSlug, "--json", "url", "-q", ".url"]);
    issueUrl = out.trim();
  } catch (err) {
    console.error(`Error: could not fetch issue ${parsed.issueNumber}`);
    process.exit(1);
  }

  let projectUrl = projectUrlArg?.trim();
  if (!projectUrl) {
    const config = getProjectConfig(projectRoot);
    projectUrl = config?.github_board ?? "";
  }
  if (!projectUrl) {
    console.error("Error: no project URL provided and .forge/project.json.github_board is empty");
    process.exit(1);
  }

  const proj = parseProjectUrl(projectUrl);
  if (!proj) {
    console.error(`Error: unsupported project URL format '${projectUrl}'`);
    console.error("Expected: https://github.com/orgs/<owner>/projects/<number>");
    process.exit(1);
  }

  gh(["project", "item-add", proj.projectNumber, "--owner", proj.owner, "--url", issueUrl]);
  console.log(`Added ${issueUrl} to project ${proj.owner}/${proj.projectNumber}.`);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
