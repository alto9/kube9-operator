---
story_id: create-chart-publishing-workflow
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - chart-publishing-automation
status: pending
---

# Create Chart Publishing GitHub Actions Workflow

## Objective

Create `.github/workflows/release-chart.yml` workflow that packages Helm charts and publishes them to S3 on GitHub releases.

## Context

This workflow automatically publishes charts when releases are created. It must package the chart, download existing index.yaml, merge new version, upload chart and index to S3, and invalidate CloudFront cache.

## Files to Create

- `.github/workflows/release-chart.yml`

## Implementation Steps

1. Create workflow with triggers:
   - release published
   - tags matching v* pattern
2. Configure job steps:
   - Checkout code
   - Install Helm CLI (v3.12.0)
   - Configure AWS credentials
   - Get bucket name from CloudFormation stack
   - Package Helm chart
   - Download existing index.yaml from S3 (or create empty)
   - Update index.yaml with helm repo index --merge
   - Upload chart package to S3 with correct content-type and cache headers
   - Upload index.yaml to S3 with correct content-type and cache headers
   - Get CloudFront distribution ID from stack
   - Invalidate CloudFront cache
   - Output success message with installation instructions

## Acceptance Criteria

- [ ] Workflow triggers on release and v* tags
- [ ] Helm CLI installed correctly
- [ ] AWS credentials configured
- [ ] Bucket name retrieved from CloudFormation stack
- [ ] Chart packaged successfully
- [ ] Index.yaml downloaded/created and merged correctly
- [ ] Chart uploaded with application/gzip content-type
- [ ] Chart uploaded with 1-year cache headers
- [ ] Index.yaml uploaded with text/yaml content-type
- [ ] Index.yaml uploaded with 5-minute cache headers
- [ ] CloudFront cache invalidated
- [ ] Success output includes installation commands

## Estimated Time

< 30 minutes

