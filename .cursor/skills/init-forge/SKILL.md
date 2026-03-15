---
name: init-forge
description: [git_flow|forge-bootstrap] Scaffold .forge structure and inject full Forge workflow
---

# Init Forge

Use the provided script to set up a project for Forge: scaffold the `.forge` structure and inject the full workflow (agents, commands, hooks, skills).

## What It Does

**1. Scaffold .forge structure**
- Reads `references/knowledge_map.json` from this skill.
- Collects all `primary_doc` and child file paths in the map.
- Creates directories and files in the target project.
- Creates blank templates by file type:
  - `.json` -> `{}` + trailing newline
  - `.md` -> blank file
- Canonical assets (always overwritten from references):
  - `.forge/skill_registry.json` from `references/skill_registry.json`
  - `.forge/knowledge_map.json` from `references/knowledge_map.json`
- Other .forge files: created only if missing (never overwritten).

**2. Inject workflow**
- Copies `agents/`, `commands/`, `hooks/`, `skills/` from the project's `.cursor/` workflow into `.cursor/` (refresh).
- Copies `hooks.json` to `~/.cursor/`.
- All workflow files are overwritten so the project gets the same exact workflow as the plugin.

## Usage

Run the script:

`node scripts/init-forge.js [target-project-path]`

- `target-project-path` is optional.
- If omitted, the script uses the current working directory.
