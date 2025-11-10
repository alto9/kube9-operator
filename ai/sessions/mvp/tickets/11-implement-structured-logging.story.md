---
story_id: implement-structured-logging
session_id: mvp
feature_id: []
spec_id: []
model_id: []
status: pending
priority: medium
estimated_minutes: 20
---

## Objective

Setup structured logging with Winston that respects LOG_LEVEL environment variable and logs in JSON format.

## Context

The operator needs consistent, structured logging for debugging and monitoring. Winston provides JSON-formatted logs that are easy to parse in log aggregation systems.

## Implementation Steps

1. Create `src/logging/logger.ts`

2. Configure Winston with:
   - Log level from environment (default: "info")
   - JSON format with timestamps
   - Console transport for stdout
   - No file transports (logs go to stdout for Kubernetes)

3. Export singleton logger instance

4. Replace all `console.log` calls with logger calls:
   - `logger.info()` for informational messages
   - `logger.warn()` for warnings
   - `logger.error()` for errors
   - `logger.debug()` for debugging

5. Add contextual metadata to log calls:
   ```typescript
   logger.info('Status updated', { mode: 'enabled', tier: 'pro' });
   ```

6. Never log sensitive data (API keys, secrets)

## Files Affected

- `src/logging/logger.ts` (create)
- All existing files (replace console.log)

## Acceptance Criteria

- [ ] Logger respects LOG_LEVEL environment variable
- [ ] All logs are JSON formatted
- [ ] Logs include timestamps
- [ ] No sensitive data in logs
- [ ] Logs go to stdout only

## Dependencies

- setup-nodejs-project

