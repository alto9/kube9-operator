---
spec_id: chart-repository-infrastructure
name: Chart Repository Infrastructure
description: AWS CDK stack for S3 + CloudFront + Route53 to host Helm charts at charts.kube9.io
feature_id:
  - chart-repository-hosting
diagram_id:
  - chart-hosting-architecture
---

# Chart Repository Infrastructure

## Overview

Self-contained AWS CDK infrastructure stack that creates S3 bucket, CloudFront distribution, and Route53 DNS record for hosting Helm charts at `https://charts.kube9.io`. This infrastructure is managed entirely within the kube9-operator repository and deployed via GitHub Actions.

## Architecture

See [chart-hosting-architecture](../diagrams/infrastructure/chart-hosting-architecture.diagram.md) for visual representation.

## CDK Stack Structure

### Directory Layout

```
infrastructure/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   └── charts-stack.ts     # Main stack definition
├── cdk.json                # CDK configuration
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

### Stack Implementation

**File**: `infrastructure/lib/charts-stack.ts`

The stack creates:

1. **S3 Bucket**
   - Purpose: Store chart packages (.tgz) and index.yaml
   - Name: `kube9-charts-{account-id}`
   - Encryption: S3-managed (SSE-S3)
   - Public access: Blocked (access via CloudFront only)
   - Versioning: Disabled
   - Lifecycle: Objects retained (no auto-deletion)

2. **CloudFront Distribution**
   - Domain: `charts.kube9.io`
   - Origin: S3 bucket (via Origin Access Control)
   - Certificate: ACM certificate for `*.kube9.io` (in us-east-1)
   - Cache: Optimized for static content
   - Compression: Enabled
   - HTTPS: Required (redirect HTTP to HTTPS)
   - Protocol: TLS 1.2+

3. **Route53 A Record**
   - Zone: `kube9.io`
   - Record: `charts.kube9.io`
   - Target: CloudFront distribution (alias)
   - Type: A record (IPv4)

### CDK Stack Interface

```typescript
export interface ChartsStackProps extends cdk.StackProps {
  /**
   * ACM certificate ARN covering *.kube9.io
   * Must be in us-east-1 region for CloudFront
   */
  certificateArn: string;
  
  /**
   * Route53 hosted zone ID for kube9.io domain
   */
  hostedZoneId: string;
  
  /**
   * Domain name for the chart repository
   * Default: charts.kube9.io
   */
  domainName?: string;
  
  /**
   * S3 bucket name (optional, will generate if not provided)
   */
  bucketName?: string;
}
```

### CDK Configuration

**File**: `infrastructure/cdk.json`

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "context": {
    "@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws"]
  }
}
```

### Dependencies

**File**: `infrastructure/package.json`

Required packages:
- `aws-cdk-lib` ^2.140.0 - CDK v2 library
- `constructs` ^10.0.0 - CDK constructs
- TypeScript and Node 22 tooling

## S3 Bucket Configuration

### Bucket Policy

Allows CloudFront to read objects via Origin Access Control:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::kube9-charts-{account-id}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::{account-id}:distribution/{distribution-id}"
        }
      }
    }
  ]
}
```

### Object Structure

```
s3://kube9-charts-{account-id}/
├── index.yaml                    # Repository index
├── kube9-operator-1.0.0.tgz     # Chart package
├── kube9-operator-1.0.1.tgz     # Chart package
└── kube9-operator-1.1.0.tgz     # Chart package
```

### Content Types

- `.tgz` files: `application/gzip`
- `index.yaml`: `text/yaml` or `application/x-yaml`

### Cache Control Headers

- Chart packages (.tgz): `public, max-age=31536000, immutable` (1 year)
- Index file (index.yaml): `public, max-age=300` (5 minutes)

## CloudFront Configuration

### Origin Access Control (OAC)

Uses modern OAC instead of legacy OAI:
- Name: `{stack-name}-oac`
- Type: S3
- Signing: Always
- Protocol: SigV4

### Cache Behaviors

**Default behavior** (all paths):
- Origin: S3 bucket via OAC
- Viewer protocol: Redirect to HTTPS
- Allowed methods: GET, HEAD, OPTIONS
- Cached methods: GET, HEAD
- Compression: Enabled
- Cache policy: CachingOptimized

### Error Responses

- 403 → 404 (for missing objects)
- 404 → 404
- TTL: 10 seconds

### Security Headers

Response headers policy:
- `Strict-Transport-Security`: max-age=31536000
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `Referrer-Policy`: strict-origin-when-cross-origin

## Route53 Configuration

### A Record

- Zone: kube9.io (must exist)
- Name: charts.kube9.io
- Type: A (alias to CloudFront)
- Target: CloudFront distribution domain
- Alias: Yes
- Evaluate target health: No

### DNS Propagation

- Initial setup: ~1-5 minutes
- Updates: ~60 seconds (CloudFront DNS TTL)
- Global propagation: ~24 hours (varies by resolver)

## GitHub Actions Integration

The stack is deployed via GitHub Actions workflow (see `chart-publishing-automation` spec).

Required GitHub Secrets:
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_ACCOUNT_ID` - AWS account ID
- `CHARTS_CERTIFICATE_ARN` - ACM certificate ARN
- `CHARTS_HOSTED_ZONE_ID` - Route53 hosted zone ID

IAM Permissions Required:
- S3: Create bucket, put object, get object
- CloudFront: Create distribution, create invalidation
- Route53: Create record, list hosted zones
- ACM: Describe certificate (read-only)
- CDK: Bootstrap, synthesize, deploy

## Stack Outputs

The stack exports these values:

1. **BucketName**: S3 bucket name
2. **BucketArn**: S3 bucket ARN
3. **DistributionId**: CloudFront distribution ID
4. **DistributionDomain**: CloudFront domain name
5. **RepositoryUrl**: https://charts.kube9.io

These outputs are used by the chart publishing workflow.

## Cost Considerations

### Monthly Estimates (approximate)

- **S3 Storage**: ~$0.02/GB (charts are small, ~$1-5/month)
- **S3 Requests**: Minimal (mostly CloudFront reads)
- **CloudFront**: $0.085/GB transferred (first 10TB)
- **Route53**: $0.50/hosted zone/month (shared)
- **ACM Certificate**: Free for public certificates

**Estimated total**: $5-20/month depending on download volume

### Cost Optimization

- CloudFront caching reduces S3 requests
- Chart packages cached for 1 year
- Index.yaml cached for 5 minutes (frequent updates)
- No unnecessary logging enabled

## Deployment Workflow

1. **Bootstrap CDK** (once): `cdk bootstrap aws://{account}/{region}`
2. **Synthesize**: `cdk synth` - Generate CloudFormation template
3. **Deploy**: `cdk deploy` - Deploy stack to AWS
4. **Verify**: Check outputs, test DNS resolution
5. **Update**: `cdk deploy` applies changes (immutable infrastructure)

## Maintenance

### Updates
- Certificate renewal: Automatic (ACM)
- DNS records: Rarely change
- CloudFront: Update cache policies as needed
- S3: No maintenance required

### Monitoring
- CloudFront metrics in CloudWatch
- S3 bucket metrics
- Route53 query logs (optional)

## Testing

### Verification Steps

1. **DNS Resolution**: `nslookup charts.kube9.io`
2. **HTTPS Access**: `curl -I https://charts.kube9.io/index.yaml`
3. **Helm Access**: `helm repo add kube9 https://charts.kube9.io`
4. **Chart Download**: `helm pull kube9/kube9-operator --version 1.0.0`

### Expected Responses

- DNS: Returns CloudFront domain
- HTTPS: 200 OK with proper headers
- Helm repo add: Success
- Helm pull: Downloads .tgz file

## Security Considerations

### Public Access
- Charts are public (by design)
- No sensitive data in charts
- S3 bucket blocks public access (via CloudFront only)

### Authentication
- No authentication required for downloads
- GitHub Actions uses IAM credentials for uploads
- Follows principle of least privilege

### Encryption
- Data in transit: TLS 1.2+ (CloudFront)
- Data at rest: SSE-S3 (S3 bucket)
- Certificate: AWS-managed (ACM)

## Disaster Recovery

### Backup Strategy
- S3 bucket: Versioning disabled, consider enabling
- Charts: Stored in git (source of truth)
- Infrastructure: Defined in CDK (reproducible)

### Recovery Procedures
1. Redeploy infrastructure via CDK
2. Republish charts from git tags
3. Regenerate index.yaml
4. Verify DNS and distribution

## Technical Requirements

- Node.js >= 22.14.0
- AWS CDK >= 2.140.0
- TypeScript >= 5.0.0
- AWS CLI configured
- Git for source control

## References

- AWS CDK Documentation: https://docs.aws.amazon.com/cdk/
- CloudFront Best Practices: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/
- Helm Chart Repository: https://helm.sh/docs/topics/chart_repository/

