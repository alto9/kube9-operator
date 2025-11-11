---
story_id: implement-registration-manager
session_id: mvp
feature_id: [server-registration]
spec_id: [server-api-spec]
model_id: [registration-data]
status: completed
priority: high
estimated_minutes: 30
---

## Objective

Implement the registration manager that handles initial registration, periodic re-registration, and state management.

## Context

The registration manager orchestrates the registration lifecycle: initial registration on startup (if API key present), periodic re-registration every 24 hours, and handling failures with retries.

## Implementation Steps

1. Create `src/registration/manager.ts`

2. Implement `RegistrationManager` class:
   - Constructor accepts config and registration client
   - `start()` method initiates registration if API key present
   - `stop()` method cleans up timers
   - Tracks registration state (isRegistered, clusterId, lastError)

3. Implement initial registration:
   - Skip if no API key
   - Call registration client
   - On success: store clusterId, schedule re-registration
   - On failure: log error, fall back to operated mode

4. Implement periodic re-registration:
   - Schedule every 24 hours (from config)
   - Call registration client again
   - Update state based on response

5. Handle errors with exponential backoff:
   - Network error: retry in 5min, 10min, 20min
   - Invalid key: don't retry, fall back to operated

6. Export registration state for status calculator

## Files Affected

- `src/registration/manager.ts` (create)
- `src/registration/state.ts` (create)
- `src/index.ts` (start registration manager)

## Acceptance Criteria

- [ ] Registers on startup if API key present
- [ ] Skips registration if no API key
- [ ] Schedules re-registration every 24 hours
- [ ] Retries on network errors with backoff
- [ ] Falls back to operated mode on invalid key
- [ ] State is accessible to status calculator

## Dependencies

- implement-registration-client

