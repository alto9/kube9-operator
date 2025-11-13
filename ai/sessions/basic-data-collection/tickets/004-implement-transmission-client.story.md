---
story_id: implement-transmission-client
session_id: basic-data-collection
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
status: completed
priority: high
estimated_minutes: 20
---

# Implement Transmission Client (Pro Tier)

## Objective

Create HTTP client for transmitting collected data to kube9-server for pro tier operators.

## Context

Pro tier operators transmit sanitized, validated data to kube9-server via HTTPS POST. The client needs to handle authentication (API key), retries, and error handling.

## Implementation Steps

1. Create `src/collection/transmission.ts` with `TransmissionClient` class
2. Implement constructor that accepts server URL and API key
3. Implement `transmit(payload: CollectionPayload): Promise<void>` method
   - POST to `https://api.kube9.dev/v1/collections` (or configured server URL)
   - Include `Authorization: Bearer {apiKey}` header
   - Include `Content-Type: application/json` header
   - Serialize payload as JSON
4. Implement retry logic with exponential backoff (max 3 retries)
5. Implement error handling for network errors, HTTP errors, and timeouts
6. Add logging for transmission attempts and results
7. Handle graceful degradation when server is unreachable

## Files Affected

- `src/collection/transmission.ts` - New file: Transmission client implementation

## Acceptance Criteria

- [ ] `transmit` method sends POST request to correct endpoint
- [ ] Authorization header includes API key
- [ ] Retry logic works with exponential backoff
- [ ] Network errors are handled gracefully (logged, not thrown)
- [ ] HTTP errors (4xx, 5xx) are logged with status codes
- [ ] Transmission operations are logged
- [ ] Client degrades gracefully when server is unreachable

## Dependencies

- 002-implement-schema-validation (uses CollectionPayload type)

