---
task_id: document-github-secrets-configuration
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
  - container-image-publishing
spec_id:
  - chart-publishing-automation
status: completed
---

# Document GitHub Secrets Configuration

## Objective

Create documentation for configuring required GitHub repository secrets for infrastructure deployment and chart/image publishing workflows.

## Context

The workflows require several GitHub secrets to be configured. This task documents what secrets are needed, where to get the values, and how to configure them in GitHub.

## Files to Create or Update

- `docs/infrastructure-setup.md` or update existing README

## Implementation Steps

1. Document required secrets:
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - AWS_ACCOUNT_ID
   - CHARTS_CERTIFICATE_ARN
   - CHARTS_HOSTED_ZONE_ID
2. Explain where to get each value
3. Provide instructions for setting secrets in GitHub UI
4. Include IAM permissions requirements
5. Add troubleshooting section

## Acceptance Criteria

- [x] All required secrets documented
- [x] Instructions for obtaining each value provided
- [x] GitHub UI navigation steps included
- [x] IAM permissions documented
- [x] Troubleshooting section included

## Estimated Time

< 20 minutes

