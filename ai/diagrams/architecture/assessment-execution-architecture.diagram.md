---
diagram_id: assessment-execution-architecture
category: architecture
---

# Assessment Execution Architecture

This diagram defines the end-to-end architecture for Well-Architected assessment execution, persistence, and CLI consumption, including runtime boundaries, execution flows, and failure semantics.

## Component Architecture

```mermaid
flowchart LR
    subgraph execution["CHECK EXECUTION LAYER"]
        runner["Assessment Runner<br/>Orchestrates run<br/>Resolves checks from registry<br/>Enforces per-check timeout<br/>Aggregates results"]
        registry["Check Registry<br/>Pluggable check registration<br/>Retrieval by pillar / check_id<br/>Check metadata validation"]
    end

    subgraph persistence["PERSISTENCE LAYER"]
        storage["Assessment Storage<br/>SQLite writes<br/>assessments table<br/>assessment_history table"]
        runstate["Run State Store<br/>Run lifecycle state<br/>queued / running / completed / failed / partial"]
    end

    subgraph presentation["PRESENTATION LAYER"]
        cli["CLI Commands<br/>query assessments list<br/>query assessments summary<br/>query assessments history<br/>query assessments get"]
        formatters["Output Formatters<br/>JSON / YAML / table"]
    end

    subgraph checks["Check Implementations"]
        c1[Security checks]
        c2[Reliability checks]
        c3[Performance checks]
        c4[Cost checks]
        c5[Operational Excellence checks]
        c6[Sustainability checks]
    end

    registry -.-> c1 & c2 & c3 & c4 & c5 & c6
    runner --> registry
    runner --> storage
    runner --> runstate
    cli --> storage
    cli --> runstate
    cli --> formatters
```

## Runtime Boundaries

| Layer        | Components                    | Responsibility                          | Boundary Rule                          |
|-------------|--------------------------------|-----------------------------------------|----------------------------------------|
| Execution   | Runner, Registry               | Execute checks, aggregate results       | No direct DB access; passes data to storage |
| Persistence | Storage, Run State Store       | Persist results, track run lifecycle    | Receives structured data from runner   |
| Presentation| CLI, Formatters                | Query and format for consumption        | Read-only; no writes                   |

**Dependency Direction**: Presentation → Persistence ← Execution (no circular dependencies).

## Execution Flow: Full Assessment Run

```mermaid
flowchart TB
    scheduler["Scheduler / Trigger<br/>Full run requested"]
    runner1["Runner<br/>Create run_id<br/>Set state: queued"]
    registry["Registry<br/>Get all checks (all pillars)"]
    runner2["Runner<br/>Set state: running<br/>For each pillar, for each check"]
    check["Execute Check<br/>Per-check timeout: 30s<br/>Return CheckResult"]
    storage1["Storage<br/>Persist each result<br/>assessments table"]
    runner3["Runner<br/>All done? → completed<br/>Run error? → failed<br/>Some fail/timeout? → partial"]
    storage2["Storage<br/>Write assessment_history row<br/>passing_count, failing_count, etc."]

    scheduler --> runner1
    runner1 --> registry
    registry --> runner2
    runner2 --> check
    check --> storage1
    storage1 --> runner3
    runner3 --> storage2
```

## Execution Flow: Pillar-Filtered Run

```mermaid
flowchart TB
    trigger["CLI or Scheduler<br/>--pillar=security,reliability"]
    runner1["Runner receives filter"]
    registry["Registry<br/>getChecksByPillars(['security','reliability'])"]
    runner2["Runner executes only filtered checks"]
    runner3["Same flow as full run<br/>Persist results<br/>Update run state"]

    trigger --> runner1
    runner1 --> registry
    registry --> runner2
    runner2 --> runner3
```

## Execution Flow: Single-Check Run

```mermaid
flowchart TB
    trigger["CLI or Scheduler<br/>--check=SEC-001"]
    runner1["Runner receives check_id"]
    registry["Registry<br/>getCheckById('SEC-001')"]
    runner2["Runner executes single check"]
    runner3["Persist result<br/>Update run state (completed/failed)"]

    trigger --> runner1
    runner1 --> registry
    registry --> runner2
    runner2 --> runner3
```

## Failure Handling: Per-Check

| Scenario      | Behavior                                      | Result Status | Persisted |
|---------------|-----------------------------------------------|---------------|-----------|
| Check passes  | Normal return                                 | `passing`     | Yes       |
| Check fails   | Check returns failing result                  | `failing`     | Yes       |
| Check timeout | Runner enforces 30s limit, aborts check       | `timeout`     | Yes       |
| Check throws  | Runner catches, records error                 | `error`       | Yes       |
| Check skipped | Check returns skipped (e.g., preconditions)   | `skipped`     | Yes       |

**Per-check timeout**: 30 seconds (configurable). Runner uses `Promise.race` or equivalent.

## Failure Handling: Per-Run

| Scenario              | Run State | Behavior                                              |
|-----------------------|-----------|-------------------------------------------------------|
| All checks succeed     | completed | Normal                                                 |
| Some fail, some pass   | partial   | Partial results persisted; run considered done         |
| Storage unavailable   | failed    | Run aborts; no/minimal persistence; error logged       |
| Runner crash          | failed    | Run state may remain `running` until cleanup job       |
| All checks fail       | completed | Run completes; all results have failing/error status   |

**Run-level timeout**: Optional; full run may have max duration (e.g., 10 minutes) to prevent runaway runs.

## Data Contracts

### Runner → Storage

```typescript
interface AssessmentResult {
  id: string;           // e.g., asm_20260216_103045_sec001_a7f3b9
  run_id: string;       // Links results to run
  pillar: string;
  check_id: string;
  check_name: string;
  status: 'passing' | 'failing' | 'warning' | 'skipped' | 'error' | 'timeout';
  object_kind?: string;
  object_namespace?: string;
  object_name?: string;
  message?: string;
  remediation?: string;
  assessed_at: string;   // ISO 8601
  duration_ms?: number;
}
```

### Registry → Runner

```typescript
interface CheckDefinition {
  id: string;
  pillar: string;
  name: string;
  description?: string;
  run: (context: CheckContext) => Promise<CheckResult>;
}

interface CheckContext {
  k8sClient: KubernetesClient;
  clusterId: string;
}
```

### CLI → Storage (Query)

```typescript
interface AssessmentQuery {
  run_id?: string;
  pillar?: string | string[];
  status?: string | string[];
  since?: string;   // ISO 8601
  limit: number;
  offset: number;
}
```

### Run State

```typescript
interface RunState {
  run_id: string;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'partial';
  scope: 'full' | 'pillar' | 'single';
  pillars?: string[];
  check_id?: string;
  requested_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}
```

## Module Ownership

| Module              | Path (planned)           | Ownership                          |
|---------------------|--------------------------|------------------------------------|
| Assessment Runner   | `src/assessment/runner.ts`   | Orchestration, timeout, aggregation |
| Check Registry      | `src/assessment/registry.ts` | Registration, retrieval             |
| Check Interface     | `src/assessment/types.ts`    | CheckDefinition, CheckResult        |
| Assessment Storage  | `src/database/assessment-repository.ts` | Persistence, queries        |
| Run State Store     | `src/assessment/run-state.ts` | Run lifecycle                      |
| CLI Commands        | `src/cli/commands/assessments.ts` | Query, format, output        |
| Scheduler           | `src/assessment/scheduler.ts`   | Trigger runs (cron, etc.)      |

## Circular Dependency Check

- **Runner** → Registry, Storage (writes)
- **Registry** → Types only
- **Storage** → Database manager
- **CLI** → Storage (reads), Formatters
- **Scheduler** → Runner

No cycles: Execution and Presentation both depend on Persistence; they do not depend on each other.
