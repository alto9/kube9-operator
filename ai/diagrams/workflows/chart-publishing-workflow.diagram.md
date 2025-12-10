---
diagram_id: chart-publishing-workflow
name: Chart Publishing Workflow
description: GitHub Actions workflow for automated Helm chart packaging and publishing to S3 on release
type: flows
spec_id:
  - chart-publishing-automation
feature_id:
  - chart-repository-hosting
---

# Chart Publishing Workflow

This diagram shows the automated workflow that packages and publishes Helm charts to S3 when a release is created.

```json
{
  "nodes": [
    {
      "id": "release",
      "type": "default",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "GitHub Release",
        "description": "Developer creates release (e.g., v1.0.0)"
      }
    },
    {
      "id": "trigger",
      "type": "default",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Workflow Trigger",
        "description": "release-chart.yml workflow starts"
      }
    },
    {
      "id": "checkout",
      "type": "default",
      "position": { "x": 500, "y": 100 },
      "data": {
        "label": "Checkout Code",
        "description": "Get repository code for release tag"
      }
    },
    {
      "id": "helm-setup",
      "type": "default",
      "position": { "x": 700, "y": 100 },
      "data": {
        "label": "Setup Helm",
        "description": "Install Helm CLI v3.12.0"
      }
    },
    {
      "id": "aws-auth",
      "type": "default",
      "position": { "x": 900, "y": 100 },
      "data": {
        "label": "AWS Authentication",
        "description": "Configure AWS credentials from secrets"
      }
    },
    {
      "id": "package",
      "type": "default",
      "position": { "x": 100, "y": 250 },
      "data": {
        "label": "Package Chart",
        "description": "helm package charts/kube9-operator"
      }
    },
    {
      "id": "download-index",
      "type": "default",
      "position": { "x": 300, "y": 250 },
      "data": {
        "label": "Download Index",
        "description": "Get existing index.yaml from S3"
      }
    },
    {
      "id": "update-index",
      "type": "default",
      "position": { "x": 500, "y": 250 },
      "data": {
        "label": "Update Index",
        "description": "helm repo index --merge"
      }
    },
    {
      "id": "upload-chart",
      "type": "default",
      "position": { "x": 700, "y": 250 },
      "data": {
        "label": "Upload Chart",
        "description": "Upload .tgz to S3 with cache headers"
      }
    },
    {
      "id": "upload-index",
      "type": "default",
      "position": { "x": 900, "y": 250 },
      "data": {
        "label": "Upload Index",
        "description": "Upload index.yaml to S3"
      }
    },
    {
      "id": "invalidate",
      "type": "default",
      "position": { "x": 500, "y": 400 },
      "data": {
        "label": "Invalidate Cache",
        "description": "CloudFront cache invalidation"
      }
    },
    {
      "id": "complete",
      "type": "default",
      "position": { "x": 500, "y": 550 },
      "data": {
        "label": "Workflow Complete",
        "description": "Chart available at charts.kube9.io"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "release",
      "target": "trigger",
      "label": "on: release: published",
      "type": "smoothstep"
    },
    {
      "id": "e2",
      "source": "trigger",
      "target": "checkout",
      "label": "step 1",
      "type": "smoothstep"
    },
    {
      "id": "e3",
      "source": "checkout",
      "target": "helm-setup",
      "label": "step 2",
      "type": "smoothstep"
    },
    {
      "id": "e4",
      "source": "helm-setup",
      "target": "aws-auth",
      "label": "step 3",
      "type": "smoothstep"
    },
    {
      "id": "e5",
      "source": "aws-auth",
      "target": "package",
      "label": "step 4",
      "type": "smoothstep"
    },
    {
      "id": "e6",
      "source": "package",
      "target": "download-index",
      "label": "step 5",
      "type": "smoothstep"
    },
    {
      "id": "e7",
      "source": "download-index",
      "target": "update-index",
      "label": "step 6",
      "type": "smoothstep"
    },
    {
      "id": "e8",
      "source": "update-index",
      "target": "upload-chart",
      "label": "step 7",
      "type": "smoothstep"
    },
    {
      "id": "e9",
      "source": "upload-chart",
      "target": "upload-index",
      "label": "step 8",
      "type": "smoothstep"
    },
    {
      "id": "e10",
      "source": "upload-index",
      "target": "invalidate",
      "label": "step 9",
      "type": "smoothstep"
    },
    {
      "id": "e11",
      "source": "invalidate",
      "target": "complete",
      "label": "success",
      "type": "smoothstep"
    }
  ]
}
```

## Workflow Steps

### 1. GitHub Release

Developer creates a GitHub release with tag (e.g., `v1.0.0`). This triggers the workflow automatically.

### 2. Workflow Trigger

The `release-chart.yml` workflow starts running on GitHub Actions runners.

### 3. Checkout Code

Workflow checks out the repository code at the release tag to ensure consistency.

### 4. Setup Helm

Installs Helm CLI v3.12.0 to package charts.

### 5. AWS Authentication

Configures AWS credentials from GitHub secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 6. Package Chart

Runs `helm package charts/kube9-operator` to create versioned `.tgz` file.

Output: `kube9-operator-1.0.0.tgz`

### 7. Download Index

Downloads existing `index.yaml` from S3 bucket to preserve previous versions.

If file doesn't exist (first chart), creates empty index structure.

### 8. Update Index

Runs `helm repo index --merge` to add new chart version to index while preserving existing entries.

### 9. Upload Chart

Uploads `.tgz` file to S3 with:
- Content-Type: `application/gzip`
- Cache-Control: `public, max-age=31536000, immutable` (1 year)

### 10. Upload Index

Uploads `index.yaml` to S3 with:
- Content-Type: `text/yaml`
- Cache-Control: `public, max-age=300` (5 minutes)

### 11. Invalidate Cache

Creates CloudFront invalidation for path `/*` to clear cached content immediately.

### 12. Workflow Complete

Chart is now available at `https://charts.kube9.io/kube9-operator-1.0.0.tgz`

Users can install with:
```bash
helm repo add kube9 https://charts.kube9.io
helm install kube9-operator kube9/kube9-operator
```

## Workflow Configuration

### Triggers

```yaml
on:
  release:
    types: [published]
  push:
    tags:
      - 'v*'
```

### Required Secrets

- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_ACCOUNT_ID` - AWS account (for CloudFormation queries)

### Environment Variables

- `AWS_REGION: 'us-east-1'` - S3 bucket and CloudFront region
- `HELM_VERSION: '3.12.0'` - Helm CLI version

## Error Handling

### Package Failures

If `helm package` fails:
- Workflow fails immediately
- Developer sees error in Actions log
- No upload occurs

### Index Merge Failures

If index merge fails:
- Previous versions may be lost
- Workflow continues (publishes chart but may have incomplete index)
- Manual index repair may be needed

### Upload Failures

If S3 upload fails:
- Retry logic in AWS CLI handles transient errors
- Workflow fails if persistent
- Chart remains unpublished

### Invalidation Failures

If CloudFront invalidation fails:
- Chart is uploaded but cached version may be stale
- Workflow continues (invalidation is best-effort)
- Cache expires naturally after 5 minutes (index) or 1 year (charts)

## Monitoring

### Workflow Status

Monitor in GitHub Actions tab:
- Success/failure rate
- Execution duration
- Error messages

### S3 Metrics

Monitor via CloudWatch:
- Object count (number of chart versions)
- Bucket size
- Request count

### CloudFront Metrics

Monitor via CloudWatch:
- Cache hit ratio
- Request count
- Error rate

## Optimization

### Parallel Uploads

Currently sequential. Could parallelize:
- Upload chart and index simultaneously
- Use `aws s3 sync` for batch operations

### Caching Strategy

Chart packages:
- **Long cache**: 1 year (immutable)
- **Strategy**: Version in filename ensures uniqueness

Index file:
- **Short cache**: 5 minutes
- **Strategy**: Frequent updates, must be fresh

### Bandwidth Savings

- CloudFront caching reduces S3 bandwidth
- Compression enabled on CloudFront
- Chart files already compressed (.tgz)

