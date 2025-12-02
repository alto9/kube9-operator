---
diagram_id: event-system-architecture
category: architecture
---

# Event System Architecture

This diagram shows the architecture of the event database and CLI query system, including **recording events from external sources** (Kubernetes Events, cluster changes), storage, querying, and integration with the VS Code extension.

```nomnoml
#direction: right
#.k8s: fill=#326ce5 stroke=#fff color=#fff
#.operator: fill=#d4edda
#.storage: fill=#fff3cd
#.cli: fill=#e8f4f8
#.extension: fill=#fff9e6
#.queue: fill=#f8d7da

[<k8s>Kubernetes Cluster|
  Event Objects|
  Nodes, Pods, Deployments|
  Services, ConfigMaps
  ---
  PRIMARY EVENT SOURCE
]

[<operator>EventRecorder Service|
  Watch API for Events|
  Informers for Resources|
  generateEventId()|
  normalizeEvent()|
  sanitizeMetadata()
  ---
  Records external events
]

[<operator>Operator Analysis|
  Insights Generator|
  Assessment System|
  Health Monitoring
  ---
  Generates analysis events
]

[<queue>Async Event Queue|
  Max 1000 events|
  Non-blocking|
  FIFO order
  ---
  Buffers recorded events
]

[<operator>Background Worker|
  Processes queue|
  Writes to database|
  Retry logic|
  Exponential backoff
]

[<storage>SQLite Database|
  /data/kube9.db
  ---
  schema_version table|
  events table|
  WAL mode enabled
]

[<storage>PersistentVolume|
  /data mount point|
  1Gi minimum
  ---
  Stores database file
]

[<cli>CLI Command Router|
  commander framework|
  zod validation
  ---
  serve (default)|
  query status|
  query events list|
  query events get
]

[<cli>Database Query Layer|
  Builds SQL queries|
  Executes with timeout|
  Returns formatted results
  ---
  JSON, YAML, or table output
]

[<extension>VS Code Extension|
  OperatorQueryClient
  ---
  Event Viewer UI|
  Status monitoring
]

[<extension>kubectl exec|
  Executes CLI in pod|
  Returns JSON results
  ---
  Protected by RBAC
]

[Kubernetes Cluster] watched by -> [EventRecorder Service]
[Operator Analysis] generates -> [EventRecorder Service]
[EventRecorder Service] adds to -> [Async Event Queue]
[Async Event Queue] processed by -> [Background Worker]
[Background Worker] writes to -> [SQLite Database]
[SQLite Database] stored on -> [PersistentVolume]

[CLI Command Router] reads from -> [SQLite Database]
[CLI Command Router] uses -> [Database Query Layer]

[VS Code Extension] executes -> [kubectl exec]
[kubectl exec] runs -> [CLI Command Router]
[CLI Command Router] returns -> [kubectl exec]
[kubectl exec] returns -> [VS Code Extension]
```

## Event Flow

### 1. Event Recording (Kubernetes → Queue)
```nomnoml
#direction: right
#.step: fill=#326ce5 stroke=#fff color=#fff
#.rec: fill=#d4edda

[<step>1. Kubernetes Cluster|
  Pod crashes|
  Event created: CrashLoopBackOff
]
[<rec>2. EventRecorder watches|
  Detects Event via Watch API
]
[<rec>3. Normalize Event|
  event_type: 'cluster'|
  severity: 'error'|
  title: 'Container crash loop'|
  object: Pod/default/nginx
]
[<rec>4. Generate Event ID|
  evt_20251202_103045_a7f3b9
]
[<rec>5. Add to Queue|
  Non-blocking|
  Returns immediately
]

[1. Kubernetes Cluster] watched by -> [2. EventRecorder watches]
[2. EventRecorder watches] normalizes -> [3. Normalize Event]
[3. Normalize Event] generates -> [4. Generate Event ID]
[4. Generate Event ID] adds -> [5. Add to Queue]
```

### 2. Event Processing (Queue → Database)
```nomnoml
#direction: right
#.step: fill=#fff3cd

[<step>1. Background Worker|
  Runs continuously
]
[<step>2. Dequeue Event|
  FIFO order
]
[<step>3. Write to SQLite|
  INSERT INTO events|
  < 1ms
]
[<step>4. Retry on Failure|
  Exponential backoff|
  Max 3 retries
]

[1. Background Worker] dequeues -> [2. Dequeue Event]
[2. Dequeue Event] writes -> [3. Write to SQLite]
[3. Write to SQLite] on error -> [4. Retry on Failure]
[4. Retry on Failure] retries -> [3. Write to SQLite]
```

### 3. Event Querying (Extension → CLI → Database)
```nomnoml
#direction: right
#.step: fill=#e8f4f8

[<step>1. VS Code Extension|
  User clicks Event Viewer
]
[<step>2. OperatorQueryClient|
  queryEvents(filters)
]
[<step>3. kubectl exec|
  exec into operator pod
]
[<step>4. CLI Query|
  kube9-operator query events list|
  --type=operator --format=json
]
[<step>5. Database Query|
  SELECT * FROM events|
  WHERE event_type = 'operator'|
  ORDER BY created_at DESC
]
[<step>6. Format & Return|
  JSON response
]

[1. VS Code Extension] calls -> [2. OperatorQueryClient]
[2. OperatorQueryClient] executes -> [3. kubectl exec]
[3. kubectl exec] runs -> [4. CLI Query]
[4. CLI Query] queries -> [5. Database Query]
[5. Database Query] formats -> [6. Format & Return]
[6. Format & Return] returns -> [1. VS Code Extension]
```

## Database Schema

```nomnoml
#direction: down
#.table: fill=#fff3cd
#.pk: fill=#d4edda
#.index: fill=#e8f4f8

[<table>schema_version|
  <pk>version INTEGER PK|
  applied_at TEXT|
  description TEXT
]

[<table>events|
  <pk>id TEXT PK|
  event_type TEXT|
  severity TEXT|
  title TEXT|
  description TEXT|
  object_kind TEXT|
  object_namespace TEXT|
  object_name TEXT|
  metadata TEXT (JSON)|
  created_at TEXT
]

[<index>Indexes|
  idx_events_type|
  idx_events_severity|
  idx_events_created|
  idx_events_object
]

[events] has -> [Indexes]
```

## Event Types and Severity

```nomnoml
#direction: right
#.type: fill=#d4edda
#.severity: fill=#f8d7da

[<type>Event Types|
  cluster|
  operator|
  insight|
  assessment|
  health|
  system
]

[<severity>Severity Levels|
  info (7 days)|
  warning (7 days)|
  error (30 days)|
  critical (30 days)
]

[Event Types] has severity -> [Severity Levels]
```

## Performance Characteristics

### Event Emission Performance
- **Queue insertion**: < 1ms
- **Throughput**: 1000 events/sec
- **Queue capacity**: 1000 events max
- **Background processing**: < 10ms per event

### Query Performance
- **CLI startup**: < 100ms
- **Get by ID**: < 1ms
- **List 100 events**: < 10ms
- **Complex filter**: < 50ms
- **Timeout**: 30 seconds max

## Storage Characteristics

### Database Size Growth
- **Empty database**: ~20KB
- **Per event**: ~100 bytes (without large metadata)
- **10,000 events**: ~1MB
- **100,000 events**: ~10MB

### Retention Policy
- **Info/Warning**: 7 days (default)
- **Error/Critical**: 30 days (default)
- **Cleanup frequency**: Every 6 hours

## Integration Points

### VS Code Extension
- Queries events via `kubectl exec` into operator pod
- Uses `OperatorQueryClient` class
- Requires `pods/exec` RBAC permission in `kube9-system` namespace
- Displays events in Event Viewer webview

### Kubernetes RBAC
- Controls access to CLI queries
- Requires `pods/exec` permission
- Standard Kubernetes security model

### Prometheus Metrics
- `kube9_events_total` - Total events by type/severity
- `kube9_events_queue_size` - Current queue size
- `kube9_events_storage_size_bytes` - Database file size
- `kube9_database_operations_total` - DB operation counters

### Health Checks
- Database connectivity verified in `/healthz`
- Unhealthy database marks operator as degraded
- Event emission failures logged and metered

## Key Design Decisions

### Why Async Queue?
- **Non-blocking**: Operator doesn't wait for database writes
- **Burst handling**: Absorbs spikes in event volume
- **Resilience**: Continues functioning during transient DB errors

### Why SQLite?
- **Embedded**: No separate database server needed
- **Zero config**: Works out of the box
- **Fast**: Excellent for read-heavy workloads
- **WAL mode**: Concurrent reads during writes

### Why CLI instead of HTTP API?
- **No endpoints**: Reduces attack surface
- **RBAC native**: Uses standard Kubernetes permissions
- **Simpler**: No authentication layer needed
- **Pattern**: Follows kubectl exec pattern

### Why Timestamp-based IDs?
- **Sortable**: Natural chronological ordering
- **Human-readable**: Timestamp visible in ID
- **Unique**: 6-char random suffix prevents collisions
- **Indexable**: Efficient database indexing

## Security Considerations

### Data Protection
- Database file is local to operator pod
- No network exposure of database
- Events never sent to external systems (free tier)

### Access Control
- CLI queries protected by Kubernetes RBAC
- Requires `pods/exec` permission
- Extension must be authenticated to Kubernetes cluster

### Sensitive Data
- Events sanitized to remove sensitive values
- Password, token, secret fields redacted
- No credentials stored in events

