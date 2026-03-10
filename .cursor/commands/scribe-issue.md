# Scribe Issue

This command invokes the Scribe agent to maintain development-ready GitHub issue(s). It refines issues so they are unambiguous and ready for development.

## Input

- GitHub issue link (`https://.../issues/123`, `owner/repo#123`, or `123`)

## Workflow

1. Retrieve issue text from GitHub using available tools.
2. Consult SME Agents (runtime, business_logic, data, interface, integration, operations) for technical information and implementation guides.
3. **Decision:** Small enough for single issue?
   - **Yes:** Update the issue based on the issue template; ensure all required details are included.
   - **No:** Refine the parent ticket; create sub-issues on the parent ticket.

## Goal

Refined tickets ready for development with no ambiguity.
