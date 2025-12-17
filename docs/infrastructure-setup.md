# Infrastructure Setup Guide

This guide walks you through configuring GitHub repository secrets required for deploying the Helm chart repository infrastructure and publishing charts/images via GitHub Actions workflows.

## Overview

The kube9-operator repository uses GitHub Actions workflows to:
- Deploy AWS infrastructure (S3, CloudFront, Route53) for hosting Helm charts
- Automatically publish Helm charts when releases are created
- Build and publish Docker images to GitHub Container Registry

These workflows require several GitHub repository secrets to be configured with AWS credentials and infrastructure identifiers.

## Prerequisites

Before configuring secrets, ensure you have:
- Access to the AWS account where infrastructure will be deployed
- Administrative access to the GitHub repository
- An AWS IAM user with appropriate permissions (see [IAM Permissions](#iam-permissions) section)
- An ACM certificate for `*.kube9.io` domain in the `us-east-1` region
- A Route53 hosted zone for the `kube9.io` domain

## Required Secrets

The following GitHub repository secrets must be configured:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID` | AWS account ID (12 digits) | `123456789012` |
| `CHARTS_CERTIFICATE_ARN` | ACM certificate ARN for `*.kube9.io` | `arn:aws:acm:us-east-1:123456789012:certificate/...` |
| `CHARTS_HOSTED_ZONE_ID` | Route53 hosted zone ID for `kube9.io` | `Z1234567890ABC` |

## Obtaining Secret Values

### AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

These credentials authenticate GitHub Actions workflows with AWS.

**Steps to create:**

1. **Create an IAM user** (if you don't have one):
   - Navigate to AWS Console → IAM → Users
   - Click "Create user"
   - Enter a username (e.g., `github-actions-charts`)
   - Click "Next"

2. **Attach IAM policy**:
   - Select "Attach policies directly"
   - Create a custom policy with the permissions listed in the [IAM Permissions](#iam-permissions) section
   - Or attach the policy JSON from [`ai/specs/infrastructure/chart-publishing-automation.spec.md`](../ai/specs/infrastructure/chart-publishing-automation.spec.md)
   - Click "Next" → "Create user"

3. **Create access keys**:
   - Select the newly created user
   - Go to the "Security credentials" tab
   - Click "Create access key"
   - Select "Application running outside AWS" as the use case
   - Click "Next" → "Create access key"
   - **Important**: Copy both the Access key ID and Secret access key immediately (you won't be able to see the secret again)

**Security Best Practices:**
- Use a dedicated IAM user for GitHub Actions (not your personal AWS account)
- Follow the least-privilege principle (see IAM Permissions section)
- Rotate access keys regularly
- Never commit access keys to the repository

### AWS_ACCOUNT_ID

The 12-digit AWS account identifier.

**How to find:**

1. **AWS Console**:
   - Look in the top-right corner of the AWS Console
   - The account ID is displayed next to your account name
   - Format: `123456789012` (12 digits)

2. **AWS CLI**:
   ```bash
   aws sts get-caller-identity --query Account --output text
   ```

### CHARTS_CERTIFICATE_ARN

The Amazon Certificate Manager (ACM) certificate ARN for the `*.kube9.io` wildcard domain.

**Requirements:**
- Certificate must be in the `us-east-1` region (CloudFront requirement)
- Certificate must cover `*.kube9.io` (wildcard) or `charts.kube9.io` (specific subdomain)
- Certificate must be validated and issued

**Steps to find:**

1. Navigate to AWS Console → Certificate Manager
2. **Important**: Ensure you're in the `us-east-1` region (use the region selector in the top-right)
3. Find your certificate for `*.kube9.io` or `charts.kube9.io`
4. Click on the certificate to view details
5. Copy the Certificate ARN
   - Format: `arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID`
   - Example: `arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012`

**If you don't have a certificate:**

1. Request a public certificate in ACM (us-east-1 region)
2. Choose "Request a public certificate"
3. Enter domain name: `*.kube9.io` (wildcard) or `charts.kube9.io` (specific)
4. Choose DNS validation
5. Add the CNAME records to your Route53 hosted zone
6. Wait for validation (usually a few minutes)
7. Copy the ARN once issued

### CHARTS_HOSTED_ZONE_ID

The Route53 hosted zone ID for the `kube9.io` domain.

**Steps to find:**

1. Navigate to AWS Console → Route53 → Hosted zones
2. Find the hosted zone for `kube9.io`
3. Copy the Hosted zone ID
   - Format: `Z1234567890ABC` (starts with "Z")
   - Example: `Z1D633PJN98FT9`

**Note:** The hosted zone ID is different from the zone name. Make sure you're copying the ID column, not the domain name.

## Configuring Secrets in GitHub

Follow these steps to add secrets to your GitHub repository:

1. **Navigate to repository settings**:
   - Go to your GitHub repository
   - Click on "Settings" (top navigation bar)

2. **Access Secrets and variables**:
   - In the left sidebar, expand "Secrets and variables"
   - Click on "Actions"

3. **Add a new secret**:
   - Click "New repository secret" button
   - Enter the secret name (e.g., `AWS_ACCESS_KEY_ID`)
   - Paste the secret value
   - Click "Add secret"

4. **Repeat for all secrets**:
   - Add each of the 5 required secrets:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_ACCOUNT_ID`
     - `CHARTS_CERTIFICATE_ARN`
     - `CHARTS_HOSTED_ZONE_ID`

5. **Verify secrets are configured**:
   - All secrets should appear in the "Repository secrets" list
   - Secret values are masked (shown as `••••••••`)
   - You can update or delete secrets at any time

**Important Notes:**
- Secret names are case-sensitive
- Secret values cannot be viewed after creation (only updated or deleted)
- Secrets are available to all workflows in the repository
- Secrets are not exposed in workflow logs (they're automatically masked)

## IAM Permissions

The AWS IAM user credentials must have specific permissions for infrastructure deployment and chart publishing. This section provides complete IAM policies with detailed explanations.

### Infrastructure Deployment IAM Policy

Required for the `deploy-infrastructure.yml` workflow. This policy includes permissions for:
- **CDK Bootstrap**: Initial CDK environment setup (one-time operation)
- **S3**: Chart repository bucket creation and configuration
- **CloudFront**: Distribution creation and management
- **Route53**: DNS record creation
- **CloudFormation**: Stack deployment and management
- **IAM**: Role creation for CloudFront origin access
- **ACM**: Certificate validation

**Complete IAM Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CDKBootstrapPermissions",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:PutBucketVersioning",
        "s3:PutBucketEncryption",
        "s3:PutBucketPolicy",
        "iam:CreateRole",
        "iam:PutRolePolicy",
        "iam:AttachRolePolicy",
        "iam:GetRole",
        "iam:PassRole",
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:DeleteParameter",
        "sts:AssumeRole"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*",
        "arn:aws:s3:::cdk-*/*",
        "arn:aws:iam::*:role/cdk-*",
        "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
      ]
    },
    {
      "Sid": "InfrastructureDeploymentPermissions",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutEncryptionConfiguration",
        "s3:GetBucketLocation",
        "s3:ListBucket",
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "route53:ChangeResourceRecordSets",
        "route53:GetHostedZone",
        "route53:ListHostedZones",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "iam:CreateRole",
        "iam:PutRolePolicy",
        "iam:AttachRolePolicy",
        "iam:GetRole",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

**Policy Explanation:**

- **CDK Bootstrap Permissions**: The first statement handles CDK bootstrap requirements. CDK bootstrap creates an S3 bucket (`cdk-{account}-{region}`) and IAM roles for CDK execution. These permissions are scoped to CDK-specific resources using wildcards.
- **Infrastructure Deployment Permissions**: The second statement covers all resources needed for deploying the chart repository infrastructure. Some permissions require `Resource: "*"` because:
  - CloudFormation needs to create resources dynamically
  - Route53 hosted zones are account-level resources
  - ACM certificates are referenced by ARN but need describe permissions

### Chart Publishing IAM Policy

Required for the `release-chart.yml` workflow. This policy is more restrictive and scoped to specific resources.

**Complete IAM Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ChartPublishingPermissions",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
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

**Policy Explanation:**

- **S3 Permissions**: Limited to buckets matching `kube9-charts-*` pattern and objects within those buckets
- **CloudFront Permissions**: Allows creating cache invalidations for any distribution (needed to refresh cached chart index)
- **CloudFormation Permissions**: Read-only access to stack outputs to retrieve bucket name and distribution ID

### Least-Privilege Principle

Following the least-privilege principle minimizes security risk by granting only the minimum permissions necessary.

#### Separate IAM Users

**Recommended Approach:**
- Create two IAM users:
  - `github-actions-infrastructure` - For infrastructure deployment (broader permissions)
  - `github-actions-publishing` - For chart publishing (restricted permissions)

**Benefits:**
- Limits blast radius if credentials are compromised
- Easier to audit and rotate credentials independently
- Publishing credentials can't accidentally modify infrastructure

#### Resource Scoping Examples

**Example 1: Scoped S3 Bucket Permissions**

Instead of allowing all S3 buckets, scope to specific bucket:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject"
  ],
  "Resource": [
    "arn:aws:s3:::kube9-charts-123456789012/*"
  ],
  "Condition": {
    "StringEquals": {
      "s3:x-amz-server-side-encryption": "AES256"
    }
  }
}
```

**Example 2: Scoped CloudFront Distribution**

If you know the distribution ID, scope permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudfront:CreateInvalidation"
  ],
  "Resource": [
    "arn:aws:cloudfront::123456789012:distribution/E1234567890ABC"
  ]
}
```

**When `Resource: "*"` is Necessary:**

Some AWS services require `Resource: "*"` because:
- **CloudFormation**: Creates resources dynamically; you can't predict ARNs beforehand
- **Route53**: Hosted zones are account-level; record creation needs account-wide permissions
- **IAM Role Creation**: Roles are created with dynamic names during stack deployment

For these cases, use additional conditions or separate the permissions into different statements.

#### Read-Only Access Where Possible

The chart publishing policy uses read-only CloudFormation access (`DescribeStacks`) since it only needs to read stack outputs, not modify the stack.

### Security Best Practices

#### Credential Management

1. **Use Dedicated IAM Users**
   - Never use personal AWS account credentials
   - Create separate users for each workflow or environment
   - Use descriptive names: `github-actions-charts-prod`, `github-actions-charts-dev`

2. **Enable MFA (Multi-Factor Authentication)**
   - Require MFA for IAM users with write permissions
   - Use hardware MFA devices or authenticator apps
   - MFA adds an extra layer of protection even if credentials are compromised

3. **Regular Credential Rotation**
   - Rotate access keys every 90 days (or per your security policy)
   - Use AWS IAM Access Key Last Used to identify unused keys
   - Rotate one key at a time to avoid service disruption

4. **Use IAM Roles Instead of Users (When Possible)**
   - For EC2 instances or Lambda functions, use IAM roles
   - Roles eliminate the need to manage access keys
   - GitHub Actions can use OIDC to assume roles (more secure than access keys)

#### Access Control

1. **Condition-Based Policies**
   - Add IP restrictions: `"Condition": { "IpAddress": { "aws:SourceIp": "192.0.2.0/24" } }`
   - Require MFA: `"Condition": { "BoolIfExists": { "aws:MultiFactorAuthPresent": "true" } }`
   - Time-based access: `"Condition": { "DateGreaterThan": { "aws:CurrentTime": "2024-01-01T00:00:00Z" } }`

2. **Resource Tagging**
   - Tag resources created by CDK/CloudFormation
   - Use tags to enforce policies: `"Condition": { "StringEquals": { "aws:RequestTag/Environment": "production" } }`

#### Monitoring and Auditing

1. **Enable CloudTrail**
   - Log all API calls made by IAM users
   - Monitor for unauthorized access attempts
   - Set up CloudWatch alarms for suspicious activity

2. **Use AWS Config**
   - Track configuration changes to infrastructure
   - Detect policy violations
   - Maintain compliance with security standards

3. **Regular Access Reviews**
   - Review IAM policies quarterly
   - Remove unused permissions
   - Verify that permissions match actual usage

4. **Set Up Alerts**
   - CloudWatch alarms for failed authentication attempts
   - SNS notifications for IAM policy changes
   - Email alerts for access key creation/deletion

#### Additional Security Measures

1. **Encryption**
   - Enable S3 bucket encryption (already configured in CDK stack)
   - Use AWS KMS for additional encryption control
   - Encrypt secrets in GitHub Secrets (automatic)

2. **Network Security**
   - Use VPC endpoints for AWS service access (if using VPC)
   - Restrict outbound traffic from GitHub Actions runners
   - Use private GitHub Actions runners for sensitive deployments

3. **Compliance**
   - Document all IAM policies and their purposes
   - Maintain audit logs of permission changes
   - Follow your organization's security policies

### Policy Application Guide

**Step 1: Create IAM Policy**

1. Navigate to AWS Console → IAM → Policies
2. Click "Create policy"
3. Choose "JSON" tab
4. Paste the appropriate policy (Infrastructure Deployment or Chart Publishing)
5. Review the policy
6. Name the policy (e.g., `GitHubActionsChartsInfrastructure`)
7. Click "Create policy"

**Step 2: Attach Policy to IAM User**

1. Navigate to IAM → Users
2. Select your IAM user
3. Go to "Permissions" tab
4. Click "Add permissions" → "Attach policies directly"
5. Search for and select your policy
6. Click "Next" → "Add permissions"

**Step 3: Test Permissions**

Before using in production, test the permissions:

```bash
# Test infrastructure deployment permissions
aws cloudformation describe-stacks --stack-name ChartsStack --region us-east-1

# Test chart publishing permissions
aws s3 ls s3://kube9-charts-123456789012/
```

### Troubleshooting IAM Permission Errors

**Common Errors and Solutions:**

1. **`AccessDenied: User is not authorized to perform: s3:CreateBucket`**
   - Verify the IAM policy includes `s3:CreateBucket`
   - Check that the policy is attached to the IAM user
   - Ensure the policy allows the specific bucket name pattern

2. **`AccessDenied: User is not authorized to perform: iam:CreateRole`**
   - CDK bootstrap requires IAM permissions
   - Verify the CDK bootstrap permissions are included
   - Check that the policy allows role creation with the `cdk-*` prefix

3. **`AccessDenied: User is not authorized to perform: cloudformation:CreateStack`**
   - Infrastructure deployment requires CloudFormation permissions
   - Verify the policy includes all CloudFormation actions listed
   - Check that the IAM user has permission to create stacks

4. **`AccessDenied: User is not authorized to perform: sts:AssumeRole`**
   - CDK execution roles require assume role permissions
   - Verify `sts:AssumeRole` is included in the policy
   - Check that the resource ARN pattern matches CDK role names

For additional troubleshooting, see the [Troubleshooting](#troubleshooting) section below.

## Troubleshooting

### Secret Not Found Errors

**Error**: `Error: Input required and not supplied: AWS_ACCESS_KEY_ID`

**Solution**:
- Verify the secret name matches exactly (case-sensitive)
- Check that the secret was added to the correct repository
- Ensure the workflow file references the secret correctly: `${{ secrets.AWS_ACCESS_KEY_ID }}`

### AWS Authentication Failures

**Error**: `Error: The security token included in the request is invalid`

**Solutions**:
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- Check that the access keys haven't been deleted or rotated
- Ensure the IAM user still exists and has active access keys
- Verify the IAM user has the required permissions

### Certificate ARN Format Issues

**Error**: `Invalid certificate ARN` or `Certificate not found`

**Solutions**:
- Verify the certificate ARN format: `arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID`
- **Critical**: Ensure the certificate is in the `us-east-1` region (CloudFront requirement)
- Check that the certificate is issued and validated (not pending)
- Verify the certificate covers `*.kube9.io` or `charts.kube9.io`

### Hosted Zone ID Format Issues

**Error**: `Invalid hosted zone ID` or `Hosted zone not found`

**Solutions**:
- Verify the hosted zone ID format: Starts with "Z" followed by alphanumeric characters
- Ensure you're copying the Hosted zone ID, not the zone name
- Verify the hosted zone exists in Route53
- Check that the hosted zone is for the correct domain (`kube9.io`)

### Region Mismatches

**Error**: `Certificate must be in us-east-1 for CloudFront`

**Solution**:
- ACM certificates used with CloudFront **must** be in the `us-east-1` region
- If your certificate is in another region, request a new certificate in `us-east-1`
- Update the `CHARTS_CERTIFICATE_ARN` secret with the new certificate ARN

### IAM Permission Errors

**Error**: `AccessDenied` or `User is not authorized to perform: s3:CreateBucket`

**Solutions**:
- Verify the IAM user has the required permissions (see IAM Permissions section)
- Check that the IAM policy is attached to the user
- Ensure the policy allows the specific actions needed
- For infrastructure deployment, the user needs broader permissions
- For chart publishing only, more restrictive permissions are sufficient

### Workflow-Specific Issues

**Infrastructure deployment fails**:
- Check CloudFormation stack status in AWS Console
- Review CDK bootstrap status (may need manual bootstrap)
- Verify all environment variables are set correctly

**Chart publishing fails**:
- Ensure infrastructure is deployed first (S3 bucket and CloudFront distribution must exist)
- Verify the CloudFormation stack name matches `ChartsStack`
- Check that the bucket name can be retrieved from stack outputs

## Verification

After configuring all secrets, verify the setup:

1. **Manual workflow trigger**:
   - Go to Actions → Deploy Chart Repository Infrastructure
   - Click "Run workflow"
   - Monitor the workflow execution
   - Check for any secret-related errors

2. **Check workflow logs**:
   - If the workflow fails, review the logs
   - Secrets are automatically masked in logs
   - Look for specific error messages related to AWS authentication or resource access

3. **Verify infrastructure**:
   - After successful deployment, check AWS Console:
     - S3 bucket exists
     - CloudFront distribution is created
     - Route53 record points to CloudFront

## Related Documentation

- [Chart Publishing Automation Spec](../ai/specs/infrastructure/chart-publishing-automation.spec.md) - Complete technical specification with IAM policies
- [Infrastructure Deployment Workflow](../.github/workflows/deploy-infrastructure.yml) - Workflow definition
- [Chart Publishing Workflow](../.github/workflows/release-chart.yml) - Chart release workflow
- [CDK Stack Implementation](../infrastructure/lib/charts-stack.ts) - Infrastructure code

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/alto9/kube9-operator/issues) for similar problems
2. Review workflow logs for detailed error messages
3. Verify AWS resource status in the AWS Console
4. Ensure all prerequisites are met

