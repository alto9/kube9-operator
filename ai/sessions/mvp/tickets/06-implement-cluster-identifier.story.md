---
story_id: implement-cluster-identifier
session_id: mvp
feature_id: [server-registration]
spec_id: [server-api-spec]
model_id: [registration-data]
status: pending
priority: high
estimated_minutes: 20
---

## Objective

Implement the cluster identifier generator that creates a unique, deterministic, non-reversible hash for the cluster.

## Context

For server registration, the operator needs to generate a unique cluster identifier. This should be a SHA256 hash of the cluster CA certificate (or server URL as fallback) that is deterministic but non-reversible.

## Implementation Steps

1. Create `src/cluster/identifier.ts`

2. Import Node.js `crypto` module

3. Implement `generateClusterIdentifier()` function:
   - Get current cluster from KubeConfig
   - If cluster has `caData`: hash it with SHA256
   - Otherwise: hash the server URL
   - Return format: `sha256:<hex>`

4. Function should be pure and deterministic

5. Add unit tests to verify:
   - Same input always produces same output
   - Format is `sha256:` + 64 hex characters
   - Non-reversible (can't extract CA or URL from hash)

## Files Affected

- `src/cluster/identifier.ts` (create)
- `src/cluster/identifier.test.ts` (create)

## Acceptance Criteria

- [ ] Generates deterministic identifier
- [ ] Uses CA certificate if available
- [ ] Falls back to server URL
- [ ] Returns `sha256:<64-hex-chars>` format
- [ ] Identifier cannot be reversed to get original data

## Dependencies

- setup-kubernetes-client

