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

The AWS IAM user credentials must have specific permissions for infrastructure deployment and chart publishing. This section provides a summary; see the [complete IAM policies](../ai/specs/infrastructure/chart-publishing-automation.spec.md#iam-permissions) for detailed JSON policies.

### Infrastructure Deployment Permissions

Required for the `deploy-infrastructure.yml` workflow:

- **S3**: Create bucket, configure bucket policies, encryption, public access blocks
- **CloudFront**: Create/update distributions, create origin access controls
- **Route53**: Create/update DNS records, read hosted zone information
- **CloudFormation**: Create/update stacks, describe stacks
- **ACM**: Describe certificate details
- **IAM**: Create roles and policies (for CloudFront origin access)

### Chart Publishing Permissions

Required for the `release-chart.yml` workflow:

- **S3**: Put/get objects, list bucket contents
- **CloudFront**: Create cache invalidations
- **CloudFormation**: Read stack outputs (to get bucket name and distribution ID)

### Least-Privilege Principle

For production environments, follow the least-privilege principle:

1. **Separate IAM users**: Use different IAM users for infrastructure deployment vs. chart publishing
2. **Resource restrictions**: Limit permissions to specific resources (buckets, distributions) when possible
3. **Read-only access**: Use read-only permissions where write access isn't needed
4. **Regular audits**: Review and rotate credentials regularly

See [`ai/specs/infrastructure/chart-publishing-automation.spec.md`](../ai/specs/infrastructure/chart-publishing-automation.spec.md) for complete IAM policy JSON examples.

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

