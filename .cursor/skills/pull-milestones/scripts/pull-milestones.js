#!/usr/bin/env node

/**
 * Pull Milestones - Fetch GitHub repository milestones for agent context.
 * Uses gh CLI. Outputs JSON or markdown.
 */

import { fileURLToPath } from "url";
import path from "path";
import { spawnSync } from "child_process";

const DEFAULTS = { state: "open", format: "json", compact: false };

/** Parse argv. Returns { ownerRepo, state, format, compact } or null or { help: true }. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 2) return null;
  let ownerRepo = null;
  let state = DEFAULTS.state;
  let format = DEFAULTS.format;
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
    } else if (!arg.startsWith("-") && arg.includes("/")) {
      if (ownerRepo != null) return null;
      ownerRepo = arg.trim();
    } else if (!arg.startsWith("-")) {
      return null;
    }
  }
  return { ownerRepo, state, format, compact };
}

/** Reduce milestone to compact fields. */
function compactMilestone(m) {
  return {
    number: m.number,
    title: m.title,
    state: m.state,
    html_url: m.html_url,
    open_issues: m.open_issues,
    closed_issues: m.closed_issues,
    due_on: m.due_on,
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

/** Format milestones as markdown table. */
function toMarkdown(milestones) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return "# Milestones\n\nNo milestones found.\n";
  }
  const lines = ["# Milestones", "", "| # | Title | State | Open | Closed | Due |", "|---|-------|-------|------|--------|-----|"];
  for (const m of milestones) {
    const num = m.number ?? "";
    const title = (m.title ?? "").replace(/\|/g, "\\|");
    const state = m.state ?? "";
    const open = m.open_issues ?? 0;
    const closed = m.closed_issues ?? 0;
    const due = m.due_on ? new Date(m.due_on).toISOString().slice(0, 10) : "-";
    lines.push(`| ${num} | ${title} | ${state} | ${open} | ${closed} | ${due} |`);
  }
  return lines.join("\n") + "\n";
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error("Usage: pull-milestones.js [owner/repo] [--state open|closed|all] [--format json|markdown] [--compact]");
    console.error("  owner/repo: optional, defaults to current repo via gh repo view");
    console.error("  --state: open (default), closed, or all");
    console.error("  --format: json (default) or markdown");
    console.error("  --compact: JSON only; return fewer fields (number, title, state, html_url, open_issues, closed_issues, due_on)");
    process.exit(1);
  }
  if (parsed.help) {
    console.log("Usage: pull-milestones.js [owner/repo] [--state open|closed|all] [--format json|markdown] [--compact]");
    process.exit(0);
  }

  run(parsed, process.cwd()).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

async function run({ ownerRepo, state, format, compact }, cwd) {
  const repo = resolveOwnerRepo(ownerRepo, cwd);
  const endpoint = `repos/${repo}/milestones${state !== "open" ? `?state=${state}` : ""}`;
  const args = ["api", endpoint, "--paginate"];
  const raw = runGh(args, cwd);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from gh api");
  }

  let milestones = Array.isArray(data) ? data : [];
  if (compact && format === "json") {
    milestones = milestones.map(compactMilestone);
  }
  if (format === "markdown") {
    console.log(toMarkdown(milestones));
  } else {
    console.log(JSON.stringify(milestones, null, 2));
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
