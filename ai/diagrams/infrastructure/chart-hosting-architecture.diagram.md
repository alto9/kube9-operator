---
diagram_id: chart-hosting-architecture
name: Chart Hosting Architecture
description: AWS infrastructure for hosting Helm charts at charts.kube9.io using S3, CloudFront, and Route53
type: infrastructure
spec_id:
  - chart-repository-infrastructure
feature_id:
  - chart-repository-hosting
---

# Chart Hosting Architecture

This diagram shows the AWS infrastructure components for hosting Helm charts publicly at `https://charts.kube9.io`.

```json
{
  "nodes": [
    {
      "id": "users",
      "type": "default",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Helm Users",
        "description": "Developers installing kube9-operator via Helm"
      }
    },
    {
      "id": "dns",
      "type": "default",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Route53",
        "description": "DNS: charts.kube9.io → CloudFront"
      }
    },
    {
      "id": "cloudfront",
      "type": "default",
      "position": { "x": 500, "y": 100 },
      "data": {
        "label": "CloudFront CDN",
        "description": "Global CDN with custom domain and TLS"
      }
    },
    {
      "id": "oac",
      "type": "default",
      "position": { "x": 500, "y": 250 },
      "data": {
        "label": "Origin Access Control",
        "description": "Secure CloudFront → S3 access"
      }
    },
    {
      "id": "s3",
      "type": "default",
      "position": { "x": 700, "y": 100 },
      "data": {
        "label": "S3 Bucket",
        "description": "Chart packages (.tgz) and index.yaml"
      }
    },
    {
      "id": "acm",
      "type": "default",
      "position": { "x": 500, "y": 400 },
      "data": {
        "label": "ACM Certificate",
        "description": "TLS certificate for *.kube9.io"
      }
    },
    {
      "id": "github",
      "type": "default",
      "position": { "x": 900, "y": 100 },
      "data": {
        "label": "GitHub Actions",
        "description": "Automated chart publishing on release"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "users",
      "target": "dns",
      "label": "helm repo add",
      "type": "smoothstep"
    },
    {
      "id": "e2",
      "source": "dns",
      "target": "cloudfront",
      "label": "A record (alias)",
      "type": "smoothstep"
    },
    {
      "id": "e3",
      "source": "cloudfront",
      "target": "oac",
      "label": "uses OAC",
      "type": "smoothstep"
    },
    {
      "id": "e4",
      "source": "oac",
      "target": "s3",
      "label": "SigV4 authenticated",
      "type": "smoothstep"
    },
    {
      "id": "e5",
      "source": "cloudfront",
      "target": "acm",
      "label": "TLS certificate",
      "type": "smoothstep"
    },
    {
      "id": "e6",
      "source": "github",
      "target": "s3",
      "label": "upload charts",
      "type": "smoothstep"
    },
    {
      "id": "e7",
      "source": "github",
      "target": "cloudfront",
      "label": "invalidate cache",
      "type": "smoothstep"
    }
  ]
}
```

## Architecture Notes

### Request Flow

1. **User runs Helm command**: `helm repo add kube9 https://charts.kube9.io`
2. **DNS resolution**: Route53 resolves `charts.kube9.io` to CloudFront distribution
3. **HTTPS request**: User's Helm client connects via HTTPS using ACM certificate
4. **CloudFront caching**: CloudFront checks cache for requested file
5. **S3 origin**: If cache miss, CloudFront fetches from S3 via OAC
6. **Response**: File returned to user with caching headers

### Security Model

- **S3 bucket**: Private, blocks all public access
- **Origin Access Control**: CloudFront uses OAC to access S3 with SigV4 signing
- **TLS certificate**: ACM certificate for `*.kube9.io` in us-east-1 region
- **No authentication**: Users access charts without credentials

### Publishing Flow

1. **GitHub release**: Developer creates release tag (e.g., `v1.0.0`)
2. **Workflow triggers**: `release-chart.yml` workflow runs
3. **Package chart**: Helm packages chart into `.tgz` file
4. **Upload to S3**: Chart package and updated `index.yaml` uploaded
5. **Invalidate cache**: CloudFront cache cleared for immediate availability

### CDK Stack Components

All infrastructure is defined in a single CDK stack:
- S3 bucket with encryption and private access
- CloudFront distribution with custom domain
- Origin Access Control for secure S3 access
- Route53 A record (alias to CloudFront)
- IAM policies for GitHub Actions access

### Cost Optimization

- **Caching**: Chart packages cached for 1 year (immutable)
- **Index caching**: `index.yaml` cached for 5 minutes (frequent updates)
- **Edge locations**: CloudFront reduces S3 requests
- **Storage**: Charts are small (~1-5MB each)

### Deployment

Infrastructure deployed via GitHub Actions:
- Workflow: `.github/workflows/deploy-infrastructure.yml`
- Trigger: Manual dispatch or changes to `infrastructure/`
- Tool: AWS CDK v2
- Duration: ~5-10 minutes for initial deployment

