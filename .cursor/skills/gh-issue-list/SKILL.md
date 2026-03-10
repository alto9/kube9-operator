---
name: gh-issue-list
description: [gh_cli|gh-issue-list] List repository issues in JSON form
---

# GH Issue List

Use the provided script to list issues from the project repository.

## Usage

Run the script: `node scripts/gh-issue-list.js [state] [limit]`

- `state`: `open`, `closed`, or `all` (default: `open`)
- `limit`: max issues returned (default: `100`)
