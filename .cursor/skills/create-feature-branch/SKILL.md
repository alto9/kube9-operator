---
name: create-feature-branch
description: [git_flow|branch-create] Create a feature branch from the root branch
---

# Create Feature Branch

Use the provided script to create a new branch from the specified root branch.

## Usage

Run the script: `scripts/create-feature-branch.js <branch-name> [root-branch]`

Default root branch is main. For sub-issues, use the parent issue branch (e.g. feature/issue-123).

When present, check CONTRIBUTING.md for project-specific branching conventions (e.g. feature/issue-N, fix/scope).
