/**
 * Shared GitHub CLI utilities for forge-cursor-plugin skills.
 */

import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { resolveProjectRoot } from "./git-utils.js";

export { resolveProjectRoot } from "./git-utils.js";

/** Read and parse .forge/project.json. Returns parsed object or null. */
export function getProjectConfig(projectRoot) {
  const projectFile = path.join(projectRoot, ".forge", "project.json");
  if (!fs.existsSync(projectFile)) return null;
  try {
    const content = fs.readFileSync(projectFile, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Parse github_url from .forge/project.json to owner/repo */
export function getRepoPath(projectRoot) {
  const data = getProjectConfig(projectRoot);
  if (!data) return null;
  const url = data.github_url;
  if (!url || typeof url !== "string") return null;
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

/** Parse issue ref to { owner, repo, issueNumber } */
export function parseIssueRef(ref, defaultRepoPath) {
  if (!ref || typeof ref !== "string") return null;
  const s = ref.trim();
  if (/^\d+$/.test(s)) {
    if (!defaultRepoPath) return null;
    const [owner, repo] = defaultRepoPath.split("/");
    return { owner, repo, issueNumber: parseInt(s, 10) };
  }
  const urlMatch = s.match(/github\.com[/:]([^/]+)\/([^/]+)\/issues\/(\d+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], issueNumber: parseInt(urlMatch[3], 10) };
  }
  const shortMatch = s.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2], issueNumber: parseInt(shortMatch[3], 10) };
  }
  return null;
}

/** Parse PR ref to { owner, repo, prNumber } */
export function parsePrRef(ref, defaultRepoPath) {
  if (!ref || typeof ref !== "string") return null;
  const s = ref.trim();
  if (/^\d+$/.test(s)) {
    if (!defaultRepoPath) return null;
    const [owner, repo] = defaultRepoPath.split("/");
    return { owner, repo, prNumber: parseInt(s, 10) };
  }
  const urlMatch = s.match(/github\.com[/:]([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], prNumber: parseInt(urlMatch[3], 10) };
  }
  const shortMatch = s.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2], prNumber: parseInt(shortMatch[3], 10) };
  }
  return null;
}

/** Run gh command. With input, reads from stdin. Optional cwd. Returns stdout or throws. */
export function gh(args, input, options = {}) {
  const opts = {
    encoding: "utf8",
    stdio: input ? ["pipe", "pipe", "inherit"] : "inherit",
    ...(input && { input }),
    ...options,
  };
  const result = spawnSync("gh", args, opts);
  if (result.status !== 0) {
    const err = result.stderr || result.error?.message || "gh command failed";
    throw new Error(err);
  }
  return result.stdout?.trim() || "";
}
