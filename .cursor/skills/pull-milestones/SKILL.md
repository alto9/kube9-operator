---
name: pull-milestones
description: [git_flow|github-milestones] Fetch repository milestones from GitHub for agent context
---

# Pull Milestones

Use the provided script to fetch GitHub repository milestones. Outputs JSON or markdown for agent consumption.

## Prerequisites

- **gh CLI** must be installed and authenticated (`gh auth status`). Run `gh auth login` if needed.

## Troubleshooting

**Permission / 403 errors:**
- Run `gh auth status` to verify you're logged in and the token is valid.
- For **private repos** or **org repos**: ensure your token has `repo` scope (`gh auth refresh -s repo`).
- For **orgs with SAML/SSO**: authorize the token at the URL shown by `gh auth status`, or run `gh auth refresh -s read:org` and complete the browser flow.

## Usage

Run the script:

`node scripts/pull-milestones.js [owner/repo] [--state open|closed|all] [--format json|markdown] [--compact]`

- `owner/repo` is optional when run from a git repository with a GitHub remote. If omitted, the script uses `gh repo view` to resolve the current repo.
- `--state`: Filter by milestone state. Default: `open`.
- `--format`: Output format. Default: `json`.
- `--compact`: JSON only; return fewer fields (number, title, state, html_url, open_issues, closed_issues, due_on).

Examples:
- `node scripts/pull-milestones.js` (uses current repo, open milestones, JSON)
- `node scripts/pull-milestones.js alto9/forge --state all --format markdown`
- `node scripts/pull-milestones.js owner/repo --state closed`

## Agent instructions

- Use this skill when you need GitHub milestone data in context (e.g., planning, roadmap alignment, issue refinement).
- When run from a gh-linked repo, omit owner/repo to use the current repository.
- On success, include the script output in context. JSON is suitable for structured parsing; markdown for human-readable summaries.
