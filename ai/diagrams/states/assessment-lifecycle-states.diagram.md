---
diagram_id: assessment-lifecycle-states
category: state
---

# Assessment Run Lifecycle States

This diagram defines the lifecycle states for a Well-Architected Framework assessment run, from initiation through completion or failure.

```mermaid
stateDiagram-v2
    [*] --> queued: Run requested (full / pillar-filtered / single-check)
    queued --> running: Runner acquires run
    running --> completed: All checks succeed
    running --> failed: Run-level error
    running --> partial: Some checks fail/timeout

    state queued {
        Run enqueued
        Waiting for execution slot
        No checks started
    }

    state running {
        Checks executing
        Results streaming to storage
        At least one check in progress
    }

    state completed {
        All checks finished successfully
        Results persisted
        No failures or timeouts
    }

    state failed {
        Run-level failure
        Runner crash
        Storage unavailable
        All checks failed
    }

    state partial {
        Some checks succeeded
        Some checks failed or timed out
        Partial results persisted
    }
```

## State Definitions

### queued
**Description**: The assessment run has been requested and is waiting for an execution slot.

**Entry**: Scheduler or CLI triggers a run; run is added to queue.

**Exit**: Runner picks up the run and begins execution.

**Characteristics**:
- No check execution has started
- Run metadata exists (run_id, requested_at, scope)
- Idempotent: duplicate requests for same scope may deduplicate

### running
**Description**: The assessment run is actively executing checks.

**Entry**: Runner dequeues the run and begins check execution.

**Exit**: All checks finish (success, failure, or timeout) or run-level error occurs.

**Characteristics**:
- At least one check is in progress or has completed
- Results may be streaming to storage incrementally
- Run is non-interruptible (no cancel mid-run in v1)

### completed
**Description**: The assessment run finished successfully with all checks executed.

**Entry**: All checks in scope completed (passing, failing, warning, or skipped).

**Exit**: Terminal state.

**Characteristics**:
- All results persisted to storage
- Run-level status is deterministic
- CLI and metrics reflect final state

### failed
**Description**: The assessment run encountered a run-level failure before completing.

**Entry**: Runner crash, storage unavailable, or all checks failed with no recoverable results.

**Exit**: Terminal state.

**Characteristics**:
- No or minimal results persisted
- Error message and run_id recorded for debugging
- Retry may be attempted by scheduler

### partial
**Description**: The assessment run completed with some checks succeeding and others failing or timing out.

**Entry**: At least one check succeeded and at least one check failed or timed out.

**Exit**: Terminal state (partial is a valid completion outcome).

**Characteristics**:
- Partial results persisted
- Run is considered "completed" for reporting (with caveats)
- Failure semantics per-check are explicit in stored results

## State Transitions

| From   | To        | Trigger                                      |
|--------|-----------|----------------------------------------------|
| (start)| queued    | Run requested (full, pillar-filtered, single)|
| queued | running   | Runner acquires run                          |
| running| completed | All checks finished successfully             |
| running| failed    | Run-level error (crash, storage down)       |
| running| partial   | Some checks fail or timeout                  |

## Per-Check vs Run-Level States

- **Run-level**: `queued`, `running`, `completed`, `failed`, `partial`
- **Per-check result status**: `passing`, `failing`, `warning`, `skipped`, `error`, `timeout`

A run in `completed` or `partial` state has per-check results; a run in `failed` state may have none.
