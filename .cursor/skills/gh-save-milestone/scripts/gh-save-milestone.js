#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { resolveProjectRoot, getProjectConfig, getRepoPath, gh } from "../../lib/gh-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve metadata_path to absolute path. */
function resolveMetadataPath(projectRoot, raw) {
  if (!raw || raw === ".forge") return path.join(projectRoot, ".forge");
  if (raw.startsWith("~")) {
    return path.join(process.env.HOME || "", raw.slice(1));
  }
  if (path.isAbsolute(raw)) return raw;
  return path.join(projectRoot, raw.replace(/^\.\//, ""));
}

function main() {
  const projectRoot = resolveProjectRoot(__dirname);
  const config = getProjectConfig(projectRoot);
  if (!config) {
    console.error("Error: .forge/project.json not found");
    process.exit(1);
  }

  const githubUrl = config.github_url;
  if (!githubUrl) {
    console.error("Error: project does not have a github_url in .forge/project.json");
    process.exit(1);
  }

  const metadataPath = resolveMetadataPath(projectRoot, config.metadata_path ?? ".forge");
  const roadmapFile = path.join(metadataPath, "roadmap.json");
  if (!fs.existsSync(roadmapFile)) {
    console.error(`Error: roadmap file not found at ${roadmapFile}`);
    process.exit(1);
  }

  const repoPath = getRepoPath(projectRoot);
  if (!repoPath || !repoPath.includes("/")) {
    console.error("Error: could not parse owner/repo from github_url");
    process.exit(1);
  }

  const roadmapContent = fs.readFileSync(roadmapFile, "utf8");
  let roadmap;
  try {
    roadmap = JSON.parse(roadmapContent);
  } catch {
    console.error("Error: invalid roadmap.json");
    process.exit(1);
  }

  const localMilestones = (roadmap.roadmap?.milestones ?? [])
    .map((m) => ({
      id: String(m.id ?? ""),
      title: String(m.title ?? ""),
      description: String(m.description ?? ""),
      due_date: String(m.due_date ?? ""),
    }))
    .filter((m) => m.title);

  if (localMilestones.length === 0) {
    console.log(`No local milestones with titles found in ${roadmapFile}. Nothing to push.`);
    return;
  }

  console.log(`Pushing milestones to ${repoPath}...`);
  let remoteMilestones = [];
  try {
    const out = gh(["api", `repos/${repoPath}/milestones?state=all&per_page=100`]);
    remoteMilestones = JSON.parse(out);
  } catch {
    remoteMilestones = [];
  }

  for (const local of localMilestones) {
    let targetNumber = null;
    if (local.id) {
      const m = remoteMilestones.find((r) => String(r.number) === local.id);
      if (m) targetNumber = m.number;
    }
    if (targetNumber == null) {
      const m = remoteMilestones.find((r) => r.title === local.title);
      if (m) targetNumber = m.number;
    }

    const payload = {
      title: local.title,
      description: local.description || undefined,
      due_on: local.due_date ? local.due_date + "T00:00:00Z" : null,
    };

    if (targetNumber != null) {
      console.log(`Updating milestone #${targetNumber}: ${local.title}`);
      gh(
        ["api", "--method", "PATCH", `repos/${repoPath}/milestones/${targetNumber}`, "--input", "-"],
        JSON.stringify(payload)
      );
    } else {
      console.log(`Creating milestone: ${local.title}`);
      const created = gh(
        ["api", "--method", "POST", `repos/${repoPath}/milestones`, "--input", "-"],
        JSON.stringify(payload)
      );
      const createdObj = JSON.parse(created);
      local.id = String(createdObj.number);
    }

    roadmap.roadmap = roadmap.roadmap || {};
    roadmap.roadmap.milestones = roadmap.roadmap.milestones || [];
    const idx = roadmap.roadmap.milestones.findIndex((m) => (m.title ?? "") === local.title);
    if (idx >= 0) {
      roadmap.roadmap.milestones[idx] = { ...roadmap.roadmap.milestones[idx], id: local.id };
    }
    fs.writeFileSync(roadmapFile, JSON.stringify(roadmap, null, 2));

    const out = gh(["api", `repos/${repoPath}/milestones?state=all&per_page=100`]);
    remoteMilestones = JSON.parse(out);
  }

  console.log(`Milestone push complete. Updated local IDs in ${roadmapFile}.`);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main();
}
