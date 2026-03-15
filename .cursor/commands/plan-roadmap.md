# Plan Roadmap

This command invokes the Planner agent to manage the GitHub roadmap. The roadmap is saved locally via `.forge/roadmap.json`. Before performing any planning action, the Planner must pull milestones and issues from GitHub and read their current status to verify the local roadmap is accurate. Once in sync, the Planner breaks out desired functionality into milestones and issues that work within the existing roadmap (which is likely in flight).

## Input

- `.forge/roadmap.json` (existing local roadmap)
- `.forge/vision.json`, `.forge/knowledge_map.json`

## Workflow

1. **pull-milestones** – Run `pull-milestones` with `[owner/repo]` to retrieve all milestones from GitHub.
2. **For each milestone returned** – Run `pull-milestone-issues` with the milestone number to retrieve issues for that milestone.
3. **Update roadmap.json** – Compare the pulled data with local `roadmap.json`; verify accuracy and correct any drift.
4. **sync-roadmap-to-github** – Run `sync-roadmap-to-github` with `[owner/repo]` to push local roadmap changes (milestones, ticket associations) to GitHub.

Resolve owner/repo from `gh repo view` when run from a gh-linked repo, or pass explicitly.

## Skills

- `pull-milestones` – Fetch milestones from GitHub
- `pull-milestone-issues` – Fetch issues for a given milestone
- `sync-roadmap-to-github` – Sync local roadmap to GitHub (create/update milestones, assign issues)

## Goal

Updated `roadmap.json` and synchronized GitHub milestones and issues.
