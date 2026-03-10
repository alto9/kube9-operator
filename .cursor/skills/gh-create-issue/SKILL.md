---
name: gh-create-issue
description: [gh_cli|gh-create-issue] Create a GitHub issue or sub-issue
---

# GH Create Issue

Use the provided script to create a new issue or sub-issue via gh CLI.

## Usage

Run the script:

`node scripts/gh-create-issue.js <title> [body] [--parent <parent-ref>]`

- **title**: Issue title (required)
- **body**: Optional description
- **--parent**: Create as sub-issue; parent-ref can be issue number, `owner/repo#123`, or full GitHub URL

Examples:
- `node scripts/gh-create-issue.js "Add feature X" "Description here"`
- `node scripts/gh-create-issue.js "Sub-task" "Details" --parent 42`
