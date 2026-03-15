---
name: sync-roadmap-to-github
description: [git_flow|github-milestones] Sync .forge/roadmap.json milestones and ticket associations to GitHub
---

# Sync Roadmap to GitHub

Use the provided script to sync `.forge/roadmap.json` to GitHub: create or update milestones, then assign issues (tickets) to their milestones.

## Prerequisites

- **gh CLI** must be installed and authenticated (`gh auth status`). Token needs `repo` scope.
- `.forge/roadmap.json` must exist in the project (or a parent directory).

## Usage

Run the script:

`node scripts/sync-roadmap-to-github.js [owner/repo] [--dry-run]`

- `owner/repo` is optional when run from a git repository with a GitHub remote. If omitted, the script uses `gh repo view` to resolve the current repo.
- `--dry-run`: Show what would be done without making changes.

## Behavior

1. **Find roadmap**: Walks up from cwd to find `.forge/roadmap.json`.
2. **Milestones**: For each milestone in `roadmap.milestones`:
   - Matches existing GitHub milestones by exact title.
   - If not found: creates the milestone (title, description, due_date).
   - If found: updates description and due_on.
3. **Tickets**: For each ticket in `milestone.tickets` (ticket `id` = GitHub issue number):
   - Assigns the issue to the milestone via PATCH.

## Roadmap format

Tickets use `id` as the GitHub issue number. Ensure tickets reference existing issues.

```json
{
  "roadmap": {
    "milestones": [
      {
        "id": "m1",
        "title": "Milestone Title",
        "description": "...",
        "due_date": "2025-06-01",
        "technical_concepts": [],
        "tickets": [
          { "id": 123, "title": "...", "description": "..." }
        ]
      }
    ]
  }
}
```

## Agent instructions

- Use this skill when the roadmap has been updated and GitHub milestones/issues should reflect it.
- Run with `--dry-run` first to preview changes.
- Requires push access to the repository.
