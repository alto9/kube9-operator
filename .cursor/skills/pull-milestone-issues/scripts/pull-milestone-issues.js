#!/usr/bin/env node

/**
 * Pull Milestone Issues - Fetch issues assigned to a milestone from GitHub.
 * Uses gh CLI. Outputs JSON or markdown.
 */

import { fileURLToPath } from "url";
import path from "path";
import { spawnSync } from "child_process";

const DEFAULTS = { state: "open", format: "json", issuesOnly: true, compact: false };

/** Parse argv. Returns { milestoneId, ownerRepo, state, format, issuesOnly, compact } or null or { help: true }. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 3) return null;
  let milestoneId = null;
  let ownerRepo = null;
  let state = DEFAULTS.state;
  let format = DEFAULTS.format;
  let issuesOnly = DEFAULTS.issuesOnly;
  let compact = DEFAULTS.compact;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "--compact") compact = true;
    else if (arg === "--state" && argv[i + 1] != null) {
      const v = argv[i + 1].toLowerCase();
      if (!["open", "closed", "all"].includes(v)) return null;
      state = v;
      i++;
    } else if (arg === "--format" && argv[i + 1] != null) {
      const v = argv[i + 1].toLowerCase();
      if (!["json", "markdown"].includes(v)) return null;
      format = v;
      i++;
    } else if (arg === "--include-prs") {
      issuesOnly = false;
    } else if (!arg.startsWith("-") && arg.includes("/")) {
      if (ownerRepo != null) return null;
      ownerRepo = arg.trim();
    } else if (!arg.startsWith("-") && /^\d+$/.test(arg)) {
      if (milestoneId != null) return null;
      milestoneId = parseInt(arg, 10);
    } else if (!arg.startsWith("-")) {
      return null;
    }
  }
  if (milestoneId == null) return null;
  return { milestoneId, ownerRepo, state, format, issuesOnly, compact };
}

/** Reduce issue to compact fields. */
function compactIssue(i) {
  return {
    number: i.number,
    title: i.title,
    body: i.body ?? null,
    state: i.state,
    html_url: i.html_url,
    assignees: (i.assignees ?? []).map((a) => a?.login ?? "").filter(Boolean),
    labels: (i.labels ?? []).map((l) => (typeof l === "string" ? l : l?.name ?? "")).filter(Boolean),
    created_at: i.created_at,
  };
}

/** Run gh command, return stdout. Throws on non-zero with full gh output. */
function runGh(args, cwd) {
  const r = spawnSync("gh", args, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    const stderr = (r.stderr || "").trim();
    const stdout = (r.stdout || "").trim();
    const err = stderr || stdout || "gh command failed";
    throw new Error(err);
  }
  return (r.stdout || "").trim();
}

/** Resolve owner/repo: from arg or via gh repo view in cwd. */
function resolveOwnerRepo(ownerRepo, cwd) {
  if (ownerRepo && ownerRepo.includes("/")) {
    return ownerRepo;
  }
  return runGh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], cwd);
}

/** Format issues as markdown table. */
function toMarkdown(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return "# Milestone Issues\n\nNo issues found.\n";
  }
  const lines = ["# Milestone Issues", "", "| # | Title | State | Assignees |", "|---|-------|-------|-----------|"];
  for (const i of issues) {
    const num = i.number ?? "";
    const title = (i.title ?? "").replace(/\|/g, "\\|");
    const state = i.state ?? "";
    const assignees = (i.assignees ?? []).map((a) => a?.login ?? "").filter(Boolean).join(", ") || "-";
    lines.push(`| ${num} | ${title} | ${state} | ${assignees} |`);
  }
  return lines.join("\n") + "\n";
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error("Usage: pull-milestone-issues.js <milestone-id> [owner/repo] [--state open|closed|all] [--format json|markdown] [--include-prs] [--compact]");
    console.error("  milestone-id: required, milestone number from pull-milestones");
    console.error("  owner/repo: optional, defaults to current repo via gh repo view");
    console.error("  --state: open (default), closed, or all");
    console.error("  --format: json (default) or markdown");
    console.error("  --include-prs: include pull requests (default: issues only)");
    console.error("  --compact: JSON only; return fewer fields (number, title, body, state, html_url, assignees, labels, created_at)");
    process.exit(1);
  }
  if (parsed.help) {
    console.log("Usage: pull-milestone-issues.js <milestone-id> [owner/repo] [--state open|closed|all] [--format json|markdown] [--include-prs] [--compact]");
    process.exit(0);
  }

  run(parsed, process.cwd()).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

async function run({ milestoneId, ownerRepo, state, format, issuesOnly, compact }, cwd) {
  const repo = resolveOwnerRepo(ownerRepo, cwd);
  const endpoint = `repos/${repo}/issues?milestone=${milestoneId}${state !== "all" ? `&state=${state}` : ""}`;
  const args = ["api", endpoint, "--paginate"];
  let raw;
  try {
    raw = runGh(args, cwd);
  } catch (err) {
    if (err.message && (err.message.includes("422") || err.message.includes("Validation Failed"))) {
      throw new Error(
        `Milestone ${milestoneId} not found in ${repo}. Run pull-milestones first to list valid milestone numbers.`
      );
    }
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from gh api");
  }

  let issues = Array.isArray(data) ? data : [];
  if (issuesOnly) {
    issues = issues.filter((i) => !i.pull_request);
  }
  if (compact && format === "json") {
    issues = issues.map(compactIssue);
  }
  if (format === "markdown") {
    console.log(toMarkdown(issues));
  } else {
    console.log(JSON.stringify(issues, null, 2));
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
