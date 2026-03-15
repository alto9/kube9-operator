---
name: pull-milestone-issues
description: [git_flow|github-milestones] Fetch all issues in a milestone from GitHub for agent context
---

# Pull Milestone Issues

Use the provided script to fetch all GitHub issues in a milestone (issues assigned to that milestone). By default returns only issues, not pull requests. Outputs JSON or markdown for agent consumption.

## Prerequisites

- **gh CLI** must be installed and authenticated (`gh auth status`). Run `gh auth login` if needed.

## Troubleshooting

**Validation Failed (422):** The milestone ID does not exist in the repository. Run `pull-milestones` first to get valid milestone numbers.

**Permission / 403 errors:**
- Run `gh auth status` to verify you're logged in and the token is valid.
- For **private repos** or **org repos**: ensure your token has `repo` scope (`gh auth refresh -s repo`).
- For **orgs with SAML/SSO**: authorize the token at the URL shown by `gh auth status`, or run `gh auth refresh -s read:org` and complete the browser flow.

## Usage

Run the script:

`node scripts/pull-milestone-issues.js <milestone-id> [owner/repo] [--state open|closed|all] [--format json|markdown] [--include-prs] [--compact]`

- `milestone-id` is required. Use the milestone number from `pull-milestones` output (the `number` field).
- `owner/repo` is optional when run from a git repository with a GitHub remote. If omitted, the script uses `gh repo view` to resolve the current repo.
- `--state`: Filter by issue state. Default: `open`.
- `--format`: Output format. Default: `json`.
- `--include-prs`: Include pull requests (default: issues only).
- `--compact`: JSON only; return fewer fields (number, title, body, state, html_url, assignees, labels, created_at).

Examples:
- `node scripts/pull-milestone-issues.js 1` (milestone 1, current repo, open issues, JSON)
- `node scripts/pull-milestone-issues.js 2 alto9/forge --state all --format markdown`
- `node scripts/pull-milestone-issues.js 3 owner/repo --state closed`

## Agent instructions

- Use this skill when you need issues for a specific milestone (e.g., sprint planning, milestone review).
- Run `pull-milestones` first to get milestone numbers, then pass the desired `number` as milestone-id.
- When run from a gh-linked repo, omit owner/repo to use the current repository.
- On success, include the script output in context. JSON is suitable for structured parsing; markdown for human-readable summaries.
