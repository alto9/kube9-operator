import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface ChartsStackProps extends cdk.StackProps {
  /**
   * ACM certificate ARN covering *.kube9.io
   * Must be in us-east-1 region for CloudFront
   */
  certificateArn: string;
  
  /**
   * Domain name for the chart repository
   * Default: charts.kube9.io
   */
  domainName?: string;
}

export class ChartsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChartsStackProps) {
    super(scope, id, props);

    // Create S3 bucket for Helm chart storage
    const accountId = cdk.Stack.of(this).account;
    const bucket = new s3.Bucket(this, 'ChartsBucket', {
      bucketName: `kube9-charts-${accountId}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    // Create Origin Access Control (OAC) for secure S3 access
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      originAccessControlName: `${this.stackName}-oac`,
      description: 'Origin Access Control for CloudFront to access S3 bucket',
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // Create response headers policy with security headers
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `${this.stackName}-security-headers`,
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    // Get domain name from props or use default
    const domainName = props.domainName || 'charts.kube9.io';

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: responseHeadersPolicy,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      domainNames: [domainName],
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn),
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: '/404',
          ttl: cdk.Duration.seconds(10),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404',
          ttl: cdk.Duration.seconds(10),
        },
      ],
    });

    // Update S3 bucket policy to allow CloudFront OAC access
    bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: 'AllowCloudFrontOAC',
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [`${bucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );

    // Export stack outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name for Helm chart storage',
    });

    new cdk.CfnOutput(this, 'BucketArn', {
      value: bucket.bucketArn,
      description: 'S3 bucket ARN for Helm chart storage',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}

