---
story_id: create-dockerfile
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: pending
priority: high
estimated_minutes: 25
---

## Objective

Create a production-ready Dockerfile for the kube9 operator.

## Context

The operator needs to be containerized for deployment to Kubernetes. The Dockerfile should use Node 22, build the TypeScript, and run the application securely.

## Implementation Steps

1. Create `Dockerfile` with multi-stage build:
   - Stage 1: Build stage using `node:22-alpine`
   - Stage 2: Production stage using `node:22-alpine`

2. Build stage:
   - Copy package*.json
   - Run `npm ci`
   - Copy source code
   - Run `npm run build`

3. Production stage:
   - Copy only production dependencies
   - Copy built dist folder
   - Run as non-root user (node)
   - Set working directory
   - Expose port 8080
   - CMD: `node dist/index.js`

4. Create `.dockerignore`:
   - node_modules
   - dist
   - .git
   - *.md

5. Test build locally: `docker build -t kube9-operator:test .`

## Files Affected

- `Dockerfile` (create)
- `.dockerignore` (create)

## Acceptance Criteria

- [ ] Image builds successfully
- [ ] Uses Node 22
- [ ] Multi-stage build keeps image small
- [ ] Runs as non-root user
- [ ] Only production dependencies included
- [ ] Image is < 200MB

## Dependencies

- setup-nodejs-project

