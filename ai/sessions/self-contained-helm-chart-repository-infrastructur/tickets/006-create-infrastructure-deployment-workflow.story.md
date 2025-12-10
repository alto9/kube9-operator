---
story_id: create-infrastructure-deployment-workflow
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - chart-publishing-automation
status: pending
---

# Create Infrastructure Deployment GitHub Actions Workflow

## Objective

Create `.github/workflows/deploy-infrastructure.yml` workflow that deploys the CDK stack to AWS when infrastructure changes are made or manually triggered.

## Context

This workflow enables automated deployment of the chart hosting infrastructure. It should run on manual dispatch or when files in `infrastructure/` directory change. The workflow must bootstrap CDK, build TypeScript, and deploy the stack.

## Files to Create

- `.github/workflows/deploy-infrastructure.yml`

## Implementation Steps

1. Create workflow file with triggers:
   - workflow_dispatch (manual)
   - push to infrastructure/ directory
2. Configure job with:
   - Node.js 22 setup
   - Checkout code
   - Install infrastructure dependencies
   - Build TypeScript
   - Configure AWS credentials from secrets
   - Bootstrap CDK (if needed, continue on error)
   - Synthesize CDK stack
   - Deploy CDK stack with environment variables
   - Get and output stack values
3. Use required secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ACCOUNT_ID, CHARTS_CERTIFICATE_ARN, CHARTS_HOSTED_ZONE_ID

## Acceptance Criteria

- [ ] Workflow file created in correct location
- [ ] Triggers configured (manual + infrastructure changes)
- [ ] Node.js 22 setup configured
- [ ] AWS credentials configured from secrets
- [ ] CDK bootstrap step (with continue-on-error)
- [ ] CDK deploy step with environment variables
- [ ] Stack outputs retrieved and displayed
- [ ] Workflow uses correct AWS region (us-east-1)

## Estimated Time

< 30 minutes

