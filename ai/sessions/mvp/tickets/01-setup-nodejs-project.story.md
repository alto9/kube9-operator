---
story_id: setup-nodejs-project
session_id: mvp
feature_id: []
spec_id: []
model_id: []
status: completed
priority: high
estimated_minutes: 25
---

## Objective

Initialize a Node.js 22 TypeScript project with necessary dependencies for the kube9 operator.

## Context

This is the foundation story for the MVP. The operator needs to be built in Node.js 22 with TypeScript, using the Kubernetes client library for cluster interactions.

## Implementation Steps

1. Create `package.json` with:
   - `name: kube9-operator`
   - `version: 1.0.0`
   - `engines: node >=22.0.0`
   - `type: module` for ES modules

2. Add dependencies:
   ```bash
   npm install @kubernetes/client-node winston express
   ```

3. Add dev dependencies:
   ```bash
   npm install -D typescript @types/node @types/express ts-node nodemon
   ```

4. Create `tsconfig.json`:
   - `target: ES2022`
   - `module: ES2022`
   - `moduleResolution: bundler`
   - `outDir: ./dist`
   - `rootDir: ./src`
   - `strict: true`

5. Create `src/index.ts` with minimal entry point
6. Add npm scripts: `build`, `dev`, `start`
7. Create `.gitignore` for `node_modules/`, `dist/`, etc.

## Files Affected

- `package.json` (create)
- `tsconfig.json` (create)
- `src/index.ts` (create)
- `.gitignore` (create)

## Acceptance Criteria

- [ ] `npm install` completes successfully
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npm run dev` starts the application in development mode
- [ ] Node version 22+ is required in package.json engines

## Dependencies

None - this is the first story

