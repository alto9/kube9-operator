---
spec_id: assessment-architecture-spec
feature_id: [well-architected-assessment]
context_id: [assessment-runner, check-registry, sqlite-storage]
---

# Assessment Architecture Specification

## Overview

This specification defines the end-to-end architecture for Well-Architected Framework assessment execution, persistence, and CLI consumption. It covers runtime modules, interfaces, data flow, failure semantics, and module ownership.

**Related Diagrams**:
- `ai/diagrams/states/assessment-lifecycle-states.diagram.md` - Run lifecycle states
- `ai/diagrams/architecture/assessment-execution-architecture.diagram.md` - Component and sequence flows

## Runtime Modules

### 1. Check Execution Layer

#### Assessment Runner
**Path**: `src/assessment/runner.ts` (planned)

**Responsibilities**:
- Orchestrate assessment runs (full, pillar-filtered, single-check)
- Resolve checks from the registry based on scope
- Execute checks with per-check timeout (default 30s)
- Aggregate results and pass to storage
- Update run state (queued → running → completed/failed/partial)
- Handle run-level errors (storage unavailable, crash)

**Interfaces**:
- `runAssessment(options: RunOptions): Promise<RunResult>`
- `runId`: Generated per run (e.g., `run_20260216_103045_a7f3b9`)

**Dependencies**: Check Registry, Assessment Storage, Run State Store

#### Check Registry
**Path**: `src/assessment/registry.ts` (planned)

**Responsibilities**:
- Register pluggable checks
- Retrieve checks by pillar or check_id
- Validate check metadata on registration
- Provide check definitions to runner

**Interfaces**:
- `register(check: CheckDefinition): void`
- `getChecksByPillars(pillars: string[]): CheckDefinition[]`
- `getCheckById(id: string): CheckDefinition | undefined`
- `getAllChecks(): CheckDefinition[]`

**Dependencies**: Types only (no storage, no runner)

### 2. Persistence Layer

#### Assessment Storage
**Path**: `src/database/assessment-repository.ts` (planned)

**Responsibilities**:
- Persist individual check results to `assessments` table
- Persist run-level aggregates to `assessment_history` table
- Support queries: by run_id, pillar, status, date range
- Enforce schema and constraints

**Interfaces**:
- `insertResult(result: AssessmentResult): void`
- `insertHistory(history: AssessmentHistoryRow): void`
- `queryAssessments(filters: AssessmentQuery): AssessmentResult[]`
- `querySummary(filters?: SummaryFilters): AssessmentSummary`

**Dependencies**: DatabaseManager, schema

#### Run State Store
**Path**: `src/assessment/run-state.ts` (planned) or embedded in `assessment_runs` table

**Responsibilities**:
- Track run lifecycle state (queued, running, completed, failed, partial)
- Store run metadata (scope, requested_at, completed_at, error)
- Support idempotent state transitions

**Interfaces**:
- `createRun(runId: string, scope: RunScope): void`
- `updateState(runId: string, state: RunState): void`
- `getRun(runId: string): RunRecord | undefined`

**Dependencies**: DatabaseManager or in-memory (for v1 single-run concurrency)

### 3. Presentation Layer

#### CLI Commands
**Path**: `src/cli/commands/assessments.ts` (planned)

**Responsibilities**:
- Parse and validate CLI arguments (pillar, status, format, limit)
- Build queries from options
- Call assessment storage for data
- Format output (JSON, YAML, table)
- Exit with appropriate codes

**Commands**:
- `query assessments list` - List assessments with filters
- `query assessments summary` - Compliance summary across pillars
- `query assessments history` - Historical results for trending
- `query assessments get <id>` - Get single assessment by ID

**Dependencies**: Assessment Storage, formatters

#### Output Formatters
**Path**: `src/cli/formatters.ts` (existing, extend)

**Responsibilities**:
- Format assessment data for JSON, YAML, table output
- Reuse existing formatter patterns from events/status

## Module Ownership Matrix

| Module            | Owns                          | Consumes From                    | Does Not Touch        |
|------------------|--------------------------------|----------------------------------|------------------------|
| Runner           | Run orchestration, timeouts    | Registry, Storage, Run State     | CLI, raw DB           |
| Registry         | Check definitions, retrieval  | Types                            | Storage, Runner, CLI   |
| Assessment Storage | Persistence, queries        | DatabaseManager                  | Registry, Runner logic |
| Run State Store  | Run lifecycle                 | DatabaseManager (if persisted)   | Check logic            |
| CLI              | Query, format, output         | Storage, Formatters              | Runner, Registry      |
| Scheduler        | Trigger timing                | Runner                           | Storage, CLI           |

## Data Contracts

### CheckDefinition (Registry → Runner)

```typescript
interface CheckDefinition {
  id: string;           // e.g., 'SEC-001'
  pillar: string;       // 'security' | 'reliability' | 'performance' | etc.
  name: string;
  description?: string;
  run: (context: CheckContext) => Promise<CheckResult>;
}

interface CheckContext {
  k8sClient: KubernetesClient;
  clusterId: string;
}
```

### CheckResult (Check → Runner)

```typescript
interface CheckResult {
  check_id: string;
  status: 'passing' | 'failing' | 'warning' | 'skipped';
  object_kind?: string;
  object_namespace?: string;
  object_name?: string;
  message?: string;
  remediation?: string;
}
```

### AssessmentResult (Runner → Storage)

```typescript
interface AssessmentResult {
  id: string;
  run_id: string;
  pillar: string;
  check_id: string;
  check_name: string;
  status: 'passing' | 'failing' | 'warning' | 'skipped' | 'error' | 'timeout';
  object_kind?: string;
  object_namespace?: string;
  object_name?: string;
  message?: string;
  remediation?: string;
  assessed_at: string;
  duration_ms?: number;
}
```

### RunState

```typescript
type RunStateValue = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

interface RunRecord {
  run_id: string;
  state: RunStateValue;
  scope: 'full' | 'pillar' | 'single';
  pillars?: string[];
  check_id?: string;
  requested_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}
```

### AssessmentQuery (CLI → Storage)

```typescript
interface AssessmentQuery {
  run_id?: string;
  pillar?: string | string[];
  status?: string | string[];
  since?: string;
  limit: number;
  offset: number;
}
```

## Failure Semantics

### Per-Check

| Scenario      | Runner Behavior              | Stored Status | Persisted |
|---------------|------------------------------|---------------|-----------|
| Check returns | Normal flow                  | passing/failing/warning/skipped | Yes |
| Check throws  | Catch, record error          | error         | Yes       |
| Check timeout | Abort after 30s              | timeout       | Yes       |

**Testability**: Unit tests can mock check that throws or hangs; runner must produce `error` or `timeout` result.

### Per-Run

| Scenario              | Run State | Behavior                                              |
|-----------------------|-----------|-------------------------------------------------------|
| All checks succeed    | completed | Normal                                                 |
| Some fail, some pass  | partial   | Partial results persisted                             |
| Storage write fails   | failed    | Abort; log error; no/minimal persistence              |
| Runner crash          | failed    | Run may remain `running` until cleanup (stale detection) |
| All checks fail       | completed | Run completes; all results have failing/error status   |

**Testability**: Integration tests can simulate storage failure; run state must be `failed`.

## Timeout Behavior

- **Per-check timeout**: 30 seconds (configurable via env or config)
- **Run-level timeout**: Optional; 10 minutes recommended for full runs to prevent runaway execution
- **Implementation**: `Promise.race(checkPromise, timeoutPromise)` or equivalent

## Repository Structure Mapping

Planned structure aligns with existing patterns:

```
src/
├── assessment/
│   ├── runner.ts
│   ├── registry.ts
│   ├── run-state.ts
│   ├── scheduler.ts
│   └── types.ts
├── database/
│   ├── assessment-repository.ts
│   └── schema.ts          # extend with assessments, assessment_history, assessment_runs
└── cli/
    ├── commands/
    │   └── assessments.ts
    └── formatters.ts      # extend
```

## Circular Dependency Verification

- Runner → Registry, Storage, Run State
- Registry → (none except types)
- Storage → DatabaseManager
- CLI → Storage, Formatters
- Scheduler → Runner

**No cycles**: Execution and Presentation both depend on Persistence; they do not depend on each other.

## Acceptance Criteria Checklist

- [x] Architecture doc describes runtime modules, interfaces, and data flow
- [x] Sequence flow exists for successful and partial/failed assessment runs
- [x] Failure semantics are explicit and testable
- [x] Documented architecture maps cleanly to repository structure
- [x] No circular dependencies
