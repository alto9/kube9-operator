---
story_id: create-cdk-project-structure
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - chart-repository-infrastructure
status: pending
---

# Create CDK Project Structure

## Objective

Create the AWS CDK project structure in `infrastructure/` directory with TypeScript configuration, package.json, and CDK app entry point.

## Context

The infrastructure will be managed as a self-contained CDK project within the kube9-operator repository. This story sets up the foundational project structure that all other infrastructure stories will build upon.

## Files to Create

- `infrastructure/bin/app.ts` - CDK app entry point
- `infrastructure/lib/charts-stack.ts` - Main stack definition (empty initially)
- `infrastructure/cdk.json` - CDK configuration
- `infrastructure/package.json` - Dependencies and scripts
- `infrastructure/tsconfig.json` - TypeScript configuration
- `infrastructure/.gitignore` - Ignore CDK artifacts

## Implementation Steps

1. Create `infrastructure/` directory structure
2. Initialize `package.json` with CDK dependencies:
   - `aws-cdk-lib` ^2.140.0
   - `constructs` ^10.0.0
   - TypeScript and build tools
3. Create `cdk.json` with CDK app configuration
4. Create `tsconfig.json` for TypeScript compilation
5. Create `bin/app.ts` that instantiates ChartsStack
6. Create `lib/charts-stack.ts` with empty stack class
7. Add `.gitignore` for CDK build artifacts

## Acceptance Criteria

- [ ] `infrastructure/package.json` exists with correct dependencies
- [ ] `cdk.json` configured with app entry point
- [ ] `tsconfig.json` configured for Node 22
- [ ] `bin/app.ts` creates ChartsStack instance
- [ ] `lib/charts-stack.ts` exports ChartsStack class
- [ ] `npm install` succeeds in infrastructure directory
- [ ] `npx cdk synth` runs without errors (empty stack)

## Estimated Time

< 30 minutes

