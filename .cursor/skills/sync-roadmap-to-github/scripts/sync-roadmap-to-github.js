#!/usr/bin/env node

/**
 * Sync Roadmap to GitHub - Create/update milestones and assign issues from .forge/roadmap.json.
 */

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

/** Parse argv. Returns { ownerRepo, dryRun } or null or { help: true }. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 2) return null;
  let ownerRepo = null;
  let dryRun = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "--dry-run") dryRun = true;
    else if (!arg.startsWith("-") && arg.includes("/")) {
      if (ownerRepo != null) return null;
      ownerRepo = arg.trim();
    } else if (!arg.startsWith("-")) {
      return null;
    }
  }
  return { ownerRepo, dryRun };
}

/** Run gh command, return stdout. Throws on non-zero. */
function runGh(args, cwd) {
  const r = spawnSync("gh", args, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "gh command failed").trim();
    throw new Error(err);
  }
  return (r.stdout || "").trim();
}

/** Resolve owner/repo: from arg or via gh repo view. */
function resolveOwnerRepo(ownerRepo, cwd) {
  if (ownerRepo && ownerRepo.includes("/")) return ownerRepo;
  return runGh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], cwd);
}

/** Find directory containing .forge/roadmap.json. */
function findRoadmapRoot(dir) {
  let current = path.resolve(dir);
  for (let i = 0; i < 20; i++) {
    const p = path.join(current, ".forge", "roadmap.json");
    if (fs.existsSync(p)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** Parse roadmap.json. Returns { milestones } or null. */
function loadRoadmap(root) {
  const p = path.join(root, ".forge", "roadmap.json");
  try {
    const content = fs.readFileSync(p, "utf8");
    const data = JSON.parse(content);
    const milestones = data?.roadmap?.milestones;
    return Array.isArray(milestones) ? milestones : null;
  } catch {
    return null;
  }
}

/** Convert roadmap due_date to GitHub due_on (ISO 8601). */
function toDueOn(dueDate) {
  if (!dueDate || typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
    return null;
  }
  return `${dueDate.trim()}T23:59:59Z`;
}

function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error("Usage: sync-roadmap-to-github.js [owner/repo] [--dry-run]");
    console.error("  owner/repo: optional, defaults to current repo via gh repo view");
    console.error("  --dry-run: preview changes without applying");
    process.exit(1);
  }
  if (parsed.help) {
    console.log("Usage: sync-roadmap-to-github.js [owner/repo] [--dry-run]");
    process.exit(0);
  }

  run(parsed, process.cwd()).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

async function run({ ownerRepo, dryRun }, cwd) {
  const root = findRoadmapRoot(cwd);
  if (!root) {
    throw new Error(".forge/roadmap.json not found. Run from project root or a subdirectory.");
  }

  const milestones = loadRoadmap(root);
  if (!milestones || milestones.length === 0) {
    throw new Error("No milestones in .forge/roadmap.json");
  }

  const repo = resolveOwnerRepo(ownerRepo, cwd);
  if (dryRun) {
    console.log(`[dry-run] Would sync ${milestones.length} milestones to ${repo}`);
  }

  const endpoint = `repos/${repo}/milestones?state=all`;
  const raw = runGh(["api", endpoint, "--paginate"], cwd);
  let existing;
  try {
    existing = JSON.parse(raw);
  } catch {
    throw new Error("Failed to fetch GitHub milestones");
  }
  const existingByTitle = new Map((existing || []).map((m) => [m.title, m]));

  for (const m of milestones) {
    const title = m.title;
    if (!title) continue;

    const desc = (m.description ?? "").replace(/\r?\n/g, " ").trim();
    const dueOn = toDueOn(m.due_date);

    let ghNumber;
    const found = existingByTitle.get(title);

    if (found) {
      ghNumber = found.number;
      if (dryRun) {
        console.log(`[dry-run] Would update milestone #${ghNumber}: ${title}`);
      } else {
        const patchEndpoint = `repos/${repo}/milestones/${ghNumber}`;
        const patchArgs = ["api", "-X", "PATCH", patchEndpoint, "-f", `title=${title}`, "-f", `description=${desc}`];
        if (dueOn) patchArgs.push("-f", `due_on=${dueOn}`);
        runGh(patchArgs, cwd);
        console.log(`Updated milestone #${ghNumber}: ${title}`);
      }
    } else {
      if (dryRun) {
        console.log(`[dry-run] Would create milestone: ${title}`);
        ghNumber = null;
      } else {
        const createArgs = ["api", "repos/" + repo + "/milestones", "-f", `title=${title}`, "-f", `description=${desc}`];
        if (dueOn) createArgs.push("-f", `due_on=${dueOn}`);
        const created = JSON.parse(runGh(createArgs, cwd));
        ghNumber = created.number;
        existingByTitle.set(title, created);
        console.log(`Created milestone #${ghNumber}: ${title}`);
      }
    }

    const tickets = m.tickets ?? [];
    for (const t of tickets) {
      const issueNum = t.id;
      if (issueNum == null || typeof issueNum !== "number") continue;
      if (ghNumber == null && dryRun) {
        console.log(`[dry-run] Would assign issue #${issueNum} to new milestone "${title}"`);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] Would assign issue #${issueNum} to milestone #${ghNumber}`);
      } else if (ghNumber != null) {
        const issueEndpoint = `repos/${repo}/issues/${issueNum}`;
        runGh(["api", "-X", "PATCH", issueEndpoint, "-f", `milestone=${ghNumber}`], cwd);
        console.log(`Assigned issue #${issueNum} to milestone #${ghNumber}`);
      }
    }
  }

  if (dryRun) {
    console.log("\n[dry-run] No changes made. Run without --dry-run to apply.");
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
