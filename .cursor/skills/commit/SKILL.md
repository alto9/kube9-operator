---
name: commit
description: [git_flow|commit-code] Commit changes with conventional commit validation
---

# Commit

Use the provided script to commit staged changes. Validates branch and runs pre-commit checks.

## Usage

Run the script: `scripts/commit.js -m "<message>"`

When present, read CONTRIBUTING.md and README.md in the repository root to determine:
- Commit message format (types, scopes, subject rules)
- Project SDLC: pre-commit validation steps, breaking change notation
- Project-specific examples

The agent generates the commit message from the changes and passes it with -m.
