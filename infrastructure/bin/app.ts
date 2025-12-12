#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChartsStack } from '../lib/charts-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
};

const certificateArn = process.env.CHARTS_CERTIFICATE_ARN;
if (!certificateArn) {
  throw new Error('CHARTS_CERTIFICATE_ARN environment variable is required');
}

new ChartsStack(app, 'ChartsStack', {
  env,
  description: 'Infrastructure for hosting Helm charts at charts.kube9.io',
  certificateArn,
});

