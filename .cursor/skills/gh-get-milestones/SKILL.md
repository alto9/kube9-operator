---
name: gh-get-milestones
description: [gh_cli|gh-get-milestones] Pull milestones from GitHub via gh api
---

# GH Get Milestones

Use the provided script to fetch GitHub milestones and print JSON.

## Usage

Run the script: `node scripts/gh-get-milestones.js [state] [per_page]`

- `state`: `open`, `closed`, or `all` (default: `all`)
- `per_page`: API page size (default: `100`)
