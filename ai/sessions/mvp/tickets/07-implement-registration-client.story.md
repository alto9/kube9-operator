---
story_id: implement-registration-client
session_id: mvp
feature_id: [server-registration]
spec_id: [server-api-spec]
model_id: [registration-data]
status: pending
priority: high
estimated_minutes: 30
---

## Objective

Implement the HTTP client that registers the operator with kube9-server using the API key.

## Context

When the operator has an API key (pro tier), it must register with kube9-server to validate the key and receive configuration. This is done via HTTPS POST to the registration endpoint.

## Implementation Steps

1. Create `src/registration/client.ts`

2. Implement `RegistrationClient` class with `register()` method:
   - POST to `${serverUrl}/v1/operator/register`
   - Include Authorization header: `Bearer ${apiKey}`
   - Include request body with operator version, cluster ID, k8s version, node count
   - Timeout after 30 seconds
   - Return registration response or throw error

3. Create request/response interfaces matching spec

4. Handle different status codes:
   - 200: Success, return response
   - 401: Invalid API key, throw error
   - 429: Rate limited, extract Retry-After header
   - 5xx: Server error, throw error for retry

5. Add comprehensive error handling

## Files Affected

- `src/registration/client.ts` (create)
- `src/registration/types.ts` (create)

## Acceptance Criteria

- [ ] Successfully POSTs to registration endpoint
- [ ] Includes API key in Authorization header
- [ ] Request body matches spec format
- [ ] Handles 200 response correctly
- [ ] Throws appropriate errors for 401, 429, 5xx
- [ ] Respects 30 second timeout

## Dependencies

- implement-cluster-identifier
- implement-config-loader

