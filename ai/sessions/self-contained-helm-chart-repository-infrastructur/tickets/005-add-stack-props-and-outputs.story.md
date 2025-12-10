---
story_id: add-stack-props-and-outputs
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - chart-repository-infrastructure
status: pending
---

# Add Stack Props Interface and Complete Outputs

## Objective

Define ChartsStackProps interface for required configuration (certificate ARN, hosted zone ID) and ensure all stack outputs are properly exported.

## Context

The CDK stack requires external configuration (ACM certificate ARN and Route53 hosted zone ID) that must be provided via stack props. Stack outputs are used by GitHub Actions workflows to discover bucket names and distribution IDs.

## Files to Modify

- `infrastructure/lib/charts-stack.ts`
- `infrastructure/bin/app.ts`

## Implementation Steps

1. Create ChartsStackProps interface with:
   - certificateArn: string (required)
   - hostedZoneId: string (required)
   - domainName?: string (optional, default: charts.kube9.io)
   - bucketName?: string (optional, auto-generated)
2. Update ChartsStack constructor to accept props
3. Update bin/app.ts to pass props from environment variables
4. Ensure all outputs exported:
   - BucketName
   - BucketArn
   - DistributionId
   - DistributionDomain
   - RepositoryUrl (https://charts.kube9.io)

## Acceptance Criteria

- [ ] ChartsStackProps interface defined with required fields
- [ ] Stack constructor accepts and uses props
- [ ] bin/app.ts reads environment variables and passes to stack
- [ ] All required outputs exported
- [ ] RepositoryUrl output set to https://charts.kube9.io
- [ ] `cdk synth` works with environment variables set

## Estimated Time

< 30 minutes

