---
story_id: 002-update-dockerfile-for-native-modules
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: pending
---

# Story: Update Dockerfile for Native Module Compilation

## Objective

Update the Dockerfile to support building `better-sqlite3` native module in the container build process.

## Acceptance Criteria

- [ ] Dockerfile installs build dependencies (python3, make, g++)
- [ ] Dockerfile properly builds native modules during `npm install`
- [ ] Built image can successfully load better-sqlite3
- [ ] Image size remains reasonable (< 200MB increase)

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/Dockerfile`

## Implementation Notes

### Dockerfile Changes

Add build dependencies before `npm install`:

```dockerfile
# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Remove build dependencies to reduce image size
RUN apk del python3 make g++
```

### Alternative: Multi-stage Build

```dockerfile
# Build stage
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
```

## Estimated Time

< 15 minutes

## Dependencies

- Story 001 (dependencies must be installed first)

