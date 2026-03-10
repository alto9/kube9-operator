# Error Handling

## Graceful Degradation
- ArgoCD detection fails → log warning, do not fail operator
- Storage write fails → log, retry with backoff
- Prometheus/ArgoCD endpoint unreachable → log warning, skip optional checks

## Per-Check (Assessments)
- Check throws → record error status, persist
- Check timeout (30s) → record timeout status

## Per-Run (Assessments)
- Storage unavailable → run state failed, abort
- Partial results → run state partial, persist what succeeded
