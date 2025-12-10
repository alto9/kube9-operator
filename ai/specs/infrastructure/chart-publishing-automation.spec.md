---
spec_id: chart-publishing-automation
name: Chart Publishing Automation
description: GitHub Actions workflows for automated infrastructure deployment and chart publishing
feature_id:
  - chart-repository-hosting
diagram_id:
  - chart-publishing-workflow
---

# Chart Publishing Automation

## Overview

Two GitHub Actions workflows manage the complete lifecycle of chart hosting infrastructure and automated chart publishing. The workflows are independent, allowing infrastructure to be deployed once and charts to be published on every release without infrastructure changes.

## Architecture

See [chart-publishing-workflow](../diagrams/workflows/chart-publishing-workflow.diagram.md) for workflow visualization.

## Workflows

### 1. Infrastructure Deployment Workflow

**File**: `.github/workflows/deploy-infrastructure.yml`

**Purpose**: Deploy or update the AWS CDK stack for chart hosting

**Triggers**:
- Manual workflow dispatch
- Push to `infrastructure/` directory
- Push to `.github/workflows/deploy-infrastructure.yml`

**Jobs**:
1. **deploy-infrastructure**
   - Checkout code
   - Setup Node.js 22
   - Install infrastructure dependencies
   - Build infrastructure (TypeScript → JavaScript)
   - Configure AWS credentials
   - Bootstrap CDK (if needed)
   - Synthesize CloudFormation template
   - Deploy CDK stack
   - Output stack values

**Workflow Definition**:

```yaml
name: Deploy Chart Repository Infrastructure

on:
  workflow_dispatch:
  push:
    branches:
      - main
    paths:
      - 'infrastructure/**'
      - '.github/workflows/deploy-infrastructure.yml'

env:
  NODE_VERSION: '22.x'
  AWS_REGION: 'us-east-1'

jobs:
  deploy-infrastructure:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'infrastructure/package-lock.json'
      
      - name: Install infrastructure dependencies
        working-directory: ./infrastructure
        run: npm ci
      
      - name: Build infrastructure
        working-directory: ./infrastructure
        run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Bootstrap CDK
        working-directory: ./infrastructure
        run: |
          npx cdk bootstrap aws://${{ secrets.AWS_ACCOUNT_ID }}/${{ env.AWS_REGION }} || true
        continue-on-error: true
      
      - name: Synthesize CDK stack
        working-directory: ./infrastructure
        run: npx cdk synth
        env:
          CHARTS_CERTIFICATE_ARN: ${{ secrets.CHARTS_CERTIFICATE_ARN }}
          CHARTS_HOSTED_ZONE_ID: ${{ secrets.CHARTS_HOSTED_ZONE_ID }}
      
      - name: Deploy CDK stack
        working-directory: ./infrastructure
        run: npx cdk deploy --require-approval never
        env:
          CHARTS_CERTIFICATE_ARN: ${{ secrets.CHARTS_CERTIFICATE_ARN }}
          CHARTS_HOSTED_ZONE_ID: ${{ secrets.CHARTS_HOSTED_ZONE_ID }}
      
      - name: Get stack outputs
        working-directory: ./infrastructure
        run: |
          BUCKET_NAME=$(aws cloudformation describe-stacks \
            --stack-name ChartsStack \
            --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
            --output text)
          DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name ChartsStack \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
            --output text)
          echo "BUCKET_NAME=$BUCKET_NAME" >> $GITHUB_ENV
          echo "DISTRIBUTION_ID=$DISTRIBUTION_ID" >> $GITHUB_ENV
      
      - name: Output deployment info
        run: |
          echo "✅ Infrastructure deployed successfully"
          echo "Bucket: ${{ env.BUCKET_NAME }}"
          echo "Distribution: ${{ env.DISTRIBUTION_ID }}"
          echo "Repository URL: https://charts.kube9.io"
```

### 2. Chart Publishing Workflow

**File**: `.github/workflows/release-chart.yml`

**Purpose**: Package and publish Helm chart to S3 on release

**Triggers**:
- GitHub release published
- Tags matching `v*` pattern

**Jobs**:
1. **publish-chart**
   - Checkout code
   - Install Helm
   - Configure AWS credentials
   - Package Helm chart
   - Download existing index.yaml
   - Update index.yaml with new version
   - Upload chart package to S3
   - Upload updated index.yaml to S3
   - Invalidate CloudFront cache

**Workflow Definition**:

```yaml
name: Release Helm Chart

on:
  release:
    types: [published]
  push:
    tags:
      - 'v*'

env:
  AWS_REGION: 'us-east-1'
  HELM_VERSION: '3.12.0'

jobs:
  publish-chart:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Install Helm
        uses: azure/setup-helm@v3
        with:
          version: ${{ env.HELM_VERSION }}
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Get bucket name from stack
        run: |
          BUCKET_NAME=$(aws cloudformation describe-stacks \
            --stack-name ChartsStack \
            --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
            --output text)
          echo "BUCKET_NAME=$BUCKET_NAME" >> $GITHUB_ENV
      
      - name: Package Helm chart
        run: |
          helm package charts/kube9-operator
          CHART_FILE=$(ls kube9-operator-*.tgz)
          echo "CHART_FILE=${CHART_FILE}" >> $GITHUB_ENV
          CHART_VERSION=$(echo ${CHART_FILE} | sed 's/kube9-operator-\(.*\)\.tgz/\1/')
          echo "CHART_VERSION=${CHART_VERSION}" >> $GITHUB_ENV
      
      - name: Download existing index.yaml
        run: |
          aws s3 cp s3://${{ env.BUCKET_NAME }}/index.yaml index.yaml \
            || echo "apiVersion: v1\nentries: {}" > index.yaml
        continue-on-error: true
      
      - name: Update index.yaml
        run: |
          helm repo index . \
            --url https://charts.kube9.io \
            --merge index.yaml
      
      - name: Upload chart package to S3
        run: |
          aws s3 cp ${{ env.CHART_FILE }} s3://${{ env.BUCKET_NAME }}/ \
            --content-type application/gzip \
            --cache-control "public, max-age=31536000, immutable" \
            --metadata-directive REPLACE
      
      - name: Upload index.yaml to S3
        run: |
          aws s3 cp index.yaml s3://${{ env.BUCKET_NAME }}/ \
            --content-type text/yaml \
            --cache-control "public, max-age=300" \
            --metadata-directive REPLACE
      
      - name: Get CloudFront distribution ID
        run: |
          DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name ChartsStack \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
            --output text)
          echo "DISTRIBUTION_ID=$DISTRIBUTION_ID" >> $GITHUB_ENV
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.DISTRIBUTION_ID }} \
            --paths "/*"
      
      - name: Output publish info
        run: |
          echo "✅ Chart published successfully"
          echo "Chart: ${{ env.CHART_FILE }}"
          echo "Version: ${{ env.CHART_VERSION }}"
          echo "Repository: https://charts.kube9.io"
          echo ""
          echo "Users can now install with:"
          echo "  helm repo add kube9 https://charts.kube9.io"
          echo "  helm install kube9-operator kube9/kube9-operator --version ${{ env.CHART_VERSION }}"
```

## GitHub Secrets Configuration

### Required Secrets

Repository secrets must be configured in GitHub:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID` | AWS account ID (12 digits) | `123456789012` |
| `CHARTS_CERTIFICATE_ARN` | ACM certificate ARN for `*.kube9.io` | `arn:aws:acm:us-east-1:123456789012:certificate/...` |
| `CHARTS_HOSTED_ZONE_ID` | Route53 hosted zone ID for `kube9.io` | `Z1234567890ABC` |

### Setting Secrets

Navigate to: Repository → Settings → Secrets and variables → Actions → New repository secret

## IAM Permissions

The AWS credentials must have these permissions:

### Infrastructure Deployment

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutEncryptionConfiguration",
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DescribeStacks",
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:CreateOriginAccessControl",
        "route53:ChangeResourceRecordSets",
        "route53:GetHostedZone",
        "acm:DescribeCertificate",
        "iam:CreateRole",
        "iam:PutRolePolicy",
        "iam:AttachRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

### Chart Publishing

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "cloudfront:CreateInvalidation",
        "cloudformation:DescribeStacks"
      ],
      "Resource": [
        "arn:aws:s3:::kube9-charts-*",
        "arn:aws:s3:::kube9-charts-*/*",
        "arn:aws:cloudfront::*:distribution/*",
        "arn:aws:cloudformation:us-east-1:*:stack/ChartsStack/*"
      ]
    }
  ]
}
```

## Workflow Execution

### Infrastructure Deployment Flow

1. **Trigger**: Manual or push to infrastructure/
2. **Checkout**: Get latest code
3. **Setup**: Install Node.js and dependencies
4. **Build**: Compile TypeScript to JavaScript
5. **AWS Auth**: Configure credentials
6. **Bootstrap**: Initialize CDK (if needed)
7. **Synthesize**: Generate CloudFormation
8. **Deploy**: Create/update stack
9. **Output**: Display stack values

### Chart Publishing Flow

1. **Trigger**: Release created or tag pushed
2. **Checkout**: Get code for the release
3. **Helm Setup**: Install Helm CLI
4. **AWS Auth**: Configure credentials
5. **Package**: Create chart .tgz file
6. **Download**: Get existing index.yaml
7. **Update**: Merge new version into index
8. **Upload Chart**: Put .tgz in S3
9. **Upload Index**: Put index.yaml in S3
10. **Invalidate**: Clear CloudFront cache
11. **Output**: Display installation commands

## Error Handling

### Common Errors

**Infrastructure Deployment**:
- Certificate not in us-east-1 → Create certificate in correct region
- Hosted zone not found → Verify CHARTS_HOSTED_ZONE_ID secret
- Permission denied → Check IAM policies
- Stack already exists → Use existing stack or delete first

**Chart Publishing**:
- Bucket not found → Deploy infrastructure first
- Version conflict → Check existing versions in index.yaml
- InvalidationBatch error → Verify distribution exists
- Permission denied → Check S3/CloudFront IAM policies

### Debugging

Enable debug logging:
- Infrastructure: Add `CDK_DEBUG=true` env var
- Workflows: Add `ACTIONS_RUNNER_DEBUG=true` repo variable

## Testing Workflows

### Local Testing

**Infrastructure**:
```bash
cd infrastructure
npm install
npm run build
export CHARTS_CERTIFICATE_ARN="arn:..."
export CHARTS_HOSTED_ZONE_ID="Z123..."
npx cdk synth
```

**Chart Publishing** (manual):
```bash
helm package charts/kube9-operator
aws s3 cp kube9-operator-1.0.0.tgz s3://bucket-name/
helm repo index . --url https://charts.kube9.io
aws s3 cp index.yaml s3://bucket-name/
```

### Workflow Validation

Test workflows without deploying:
- Use `workflow_dispatch` with dry-run parameters
- Fork repository and test in fork
- Use `act` tool for local GitHub Actions execution

## Monitoring and Alerts

### CloudWatch Metrics

Monitor:
- S3 bucket storage size
- CloudFront requests and errors
- CloudFront cache hit ratio
- Lambda@Edge errors (if used)

### Alarms

Recommended CloudWatch alarms:
- CloudFront 5xx error rate > 1%
- S3 4xx error rate > 5%
- CloudFront data transfer anomaly

### GitHub Actions

Monitor workflow runs:
- Success/failure rate
- Execution duration
- Dependency vulnerabilities

## Maintenance

### Dependency Updates

**Infrastructure**:
- Update CDK: `npm update aws-cdk-lib` in infrastructure/
- Update Node.js: Change NODE_VERSION in workflows

**Workflows**:
- Update action versions: `actions/checkout@v4` → `@v5`
- Update Helm version: Change HELM_VERSION

### Certificate Renewal

ACM certificates auto-renew if:
- DNS validation configured
- Route53 hosted zone accessible
- Certificate used by CloudFront

No action required for renewal.

## Security Best Practices

### Secrets Management
- Rotate AWS credentials quarterly
- Use least-privilege IAM policies
- Never commit secrets to git
- Use GitHub organization secrets for shared values

### Access Control
- Limit who can trigger infrastructure workflow
- Require approvals for production deployments
- Use environment protection rules
- Enable branch protection on main

### Audit
- Enable CloudTrail for AWS API calls
- Review GitHub Actions audit log
- Monitor S3 access logs
- Track CloudFront access patterns

## Troubleshooting

### Infrastructure won't deploy
1. Check AWS credentials validity
2. Verify certificate ARN and region
3. Confirm hosted zone ID correct
4. Check IAM permissions complete
5. Review CDK stack events in CloudFormation console

### Charts won't publish
1. Verify infrastructure deployed successfully
2. Check S3 bucket exists and accessible
3. Validate chart package with `helm lint`
4. Review workflow logs for errors
5. Confirm CloudFormation stack outputs available

### Users can't access charts
1. Test DNS: `nslookup charts.kube9.io`
2. Test HTTPS: `curl -I https://charts.kube9.io/index.yaml`
3. Check CloudFront distribution status
4. Verify S3 bucket policy allows CloudFront
5. Check Route53 A record points to distribution

## Technical Requirements

- GitHub Actions enabled on repository
- AWS account with billing enabled
- Node.js 22+ for infrastructure
- Helm 3.8+ for chart packaging
- Git tags for version management

## References

- GitHub Actions: https://docs.github.com/en/actions
- AWS CDK: https://docs.aws.amazon.com/cdk/
- Helm Chart Repository: https://helm.sh/docs/topics/chart_repository/
- CloudFormation: https://docs.aws.amazon.com/cloudformation/

