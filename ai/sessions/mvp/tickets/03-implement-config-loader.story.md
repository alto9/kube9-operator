---
story_id: implement-config-loader
session_id: mvp
feature_id: [server-registration]
spec_id: [server-api-spec]
model_id: []
status: pending
priority: high
estimated_minutes: 25
---

## Objective

Implement configuration loader that reads the operator's configuration including the optional API key from Kubernetes Secret.

## Context

The operator needs to load its API key (if present) from a Kubernetes Secret to determine whether to run in "operated" (free) or "enabled" (pro) mode.

## Implementation Steps

1. Create `src/config/loader.ts`

2. Implement `loadConfig()` function that:
   - Reads environment variables (LOG_LEVEL, SERVER_URL, etc.)
   - Attempts to read Secret `kube9-operator-config` from `kube9-system` namespace
   - Extracts and decodes API key from Secret if it exists
   - Returns config object with `apiKey: string | null`

3. Handle 404 gracefully (Secret doesn't exist = free tier)

4. Create `Config` interface:
   ```typescript
   interface Config {
     apiKey: string | null;
     serverUrl: string;
     logLevel: string;
     statusUpdateIntervalSeconds: number;
     reregistrationIntervalHours: number;
   }
   ```

5. Export config as singleton after loading

## Files Affected

- `src/config/loader.ts` (create)
- `src/config/types.ts` (create)
- `src/index.ts` (load config at startup)

## Acceptance Criteria

- [ ] Config loads from environment variables
- [ ] API key is read from Secret if present
- [ ] Returns null API key if Secret doesn't exist (no error)
- [ ] Never logs the API key value
- [ ] Config is loaded once at startup

## Dependencies

- setup-kubernetes-client

