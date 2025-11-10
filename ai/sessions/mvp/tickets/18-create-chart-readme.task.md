---
task_id: create-chart-readme
session_id: mvp
type: documentation
status: pending
priority: low
---

## Description

Create comprehensive README.md for the Helm chart with installation instructions, configuration options, and examples.

## Reason

Users need clear documentation to understand how to install and configure the operator via Helm.

## Steps

1. Create `charts/kube9-operator/README.md`

2. Include sections:
   - Overview
   - Prerequisites (kubectl, helm, cluster access)
   - Installation instructions for free tier
   - Installation instructions for pro tier
   - Configuration options (all values.yaml fields)
   - Examples (custom values, upgrade, uninstall)
   - Troubleshooting common issues
   - Values table with descriptions

3. Add code examples for:
   - Adding Helm repo
   - Free tier install
   - Pro tier install with API key
   - Custom values.yaml
   - Upgrade command
   - Uninstall command

4. Include link to getting API key: https://portal.kube9.dev

## Resources

- Helm chart best practices: https://helm.sh/docs/chart_best_practices/
- values.yaml for field reference
- Feature files for functionality reference

## Completion Criteria

- [ ] README includes all installation methods
- [ ] All values.yaml fields are documented
- [ ] Code examples are accurate
- [ ] Links are working
- [ ] Troubleshooting section is helpful

