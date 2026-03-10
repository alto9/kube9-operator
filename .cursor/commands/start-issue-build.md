<!-- forge-hash: 6fe9f5cdb8d7f24d10f22a57080d989cb211bdac040e5291e26482c4dc66ea2a -->

# Start Issue Build

This command activates the staged build workflow from an issue reference. It prepares issue context and branch state, then hands execution to build-stage subagents.

## Input

- GitHub issue reference (`https://.../issues/123`, `owner/repo#123`, or `123`)

## Skill Resolution

- Resolve assigned skills from `.forge/skill_registry.json` at `command_assignments.start-issue-build`.
- For each assigned skill ID, execute using the matching `skills[]` entry `script_path` and `usage`.
- Do not duplicate script command strings in this command document.

## Workflow

1. Parse and validate issue reference.
2. Run `gh-get-issue` using the registry usage string to resolve issue details and root branch.
3. Run `create-feature-branch` using the registry usage string with `feature/issue-{number}` from the root branch.
5. Handoff to staged build agents:
   - `build_preparation`
   - `build_development`
   - `build_security`
   - `build_wrap`

## Goal

Produce a prepared branch and normalized issue context that can flow through the staged build pipeline.
