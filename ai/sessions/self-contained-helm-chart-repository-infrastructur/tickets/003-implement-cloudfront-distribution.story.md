---
story_id: implement-cloudfront-distribution
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - chart-repository-infrastructure
status: completed
---

# Implement CloudFront Distribution with OAC

## Objective

Create CloudFront distribution with Origin Access Control (OAC) for secure S3 access, custom domain support, and optimized caching for Helm charts.

## Context

CloudFront provides global CDN distribution for charts.kube9.io. It uses OAC (not legacy OAI) to securely access the private S3 bucket. The distribution must support HTTPS with ACM certificate and proper cache behaviors.

## Files to Modify

- `infrastructure/lib/charts-stack.ts`

## Implementation Steps

1. Create Origin Access Control (OAC) for S3 access
2. Create CloudFront distribution with:
   - Origin: S3 bucket via OAC
   - Domain aliases: charts.kube9.io
   - Certificate: ACM certificate ARN (from stack props)
   - Viewer protocol: Redirect HTTP to HTTPS
   - Cache policy: CachingOptimized
   - Compression: Enabled
   - Error responses: 403 → 404
3. Create response headers policy with security headers
4. Update S3 bucket policy to allow CloudFront OAC access
5. Export distribution ID and domain as stack outputs

## Acceptance Criteria

- [x] OAC created and configured for S3
- [x] CloudFront distribution created with custom domain
- [x] ACM certificate referenced correctly
- [x] HTTPS redirect configured
- [x] Cache policy optimized for static content
- [x] Security headers policy applied
- [x] S3 bucket policy allows CloudFront access via OAC
- [x] Stack outputs include DistributionId and DistributionDomain

## Estimated Time

< 30 minutes

