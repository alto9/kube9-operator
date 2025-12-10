---
task_id: document-iam-permissions
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - chart-publishing-automation
status: pending
---

# Document IAM Permissions Requirements

## Objective

Create documentation detailing the IAM permissions required for infrastructure deployment and chart publishing workflows.

## Context

The AWS credentials used by GitHub Actions need specific IAM permissions. This task documents the minimum required permissions for both infrastructure deployment and chart publishing operations.

## Files to Create or Update

- `docs/infrastructure-setup.md` or update existing README

## Implementation Steps

1. Document IAM policy for infrastructure deployment:
   - S3 bucket creation and configuration
   - CloudFront distribution creation
   - Route53 record creation
   - CloudFormation stack management
   - CDK bootstrap permissions
2. Document IAM policy for chart publishing:
   - S3 object uploads
   - CloudFront invalidation
   - CloudFormation read access
3. Provide example IAM policies (JSON)
4. Explain least-privilege principle
5. Add security best practices

## Acceptance Criteria

- [ ] Infrastructure deployment permissions documented
- [ ] Chart publishing permissions documented
- [ ] Example IAM policies provided
- [ ] Least-privilege principle explained
- [ ] Security best practices included

## Estimated Time

< 20 minutes

