---
spec_id: cli-architecture-spec
feature_id: [cli-query-interface]
context_id: [nodejs-cli, commander-framework]
---

# CLI Architecture Specification

## Overview

This specification defines the command-line interface architecture for the kube9-operator, including command structure, argument parsing, validation, and integration with the VS Code extension.

## CLI Framework

### Dependencies

```json
{
  "commander": "^12.0.0",
  "zod": "^3.22.0"
}
```

- **commander**: CLI framework for command routing and argument parsing
- **zod**: Runtime type validation for CLI arguments and responses

## Command Structure

### Binary Modes

The `kube9-operator` binary operates in two distinct modes:

1. **Serve Mode** (default): Runs the operator control loop
2. **Query Mode**: Executes CLI queries and exits

### Top-Level Commands

```
kube9-operator [command] [options]

Commands:
  serve               Run operator control loop (default)
  query <subcommand>  Query operator data

Options:
  -h, --help          Display help
  -v, --version       Display version
```

### Query Subcommands

```
kube9-operator query <subcommand> [options]

Subcommands:
  status              Get operator status
  events <action>     Query events

Events Actions:
  list [options]      List events with optional filters
  get <event-id>      Get single event by ID
```

## Implementation Architecture

### Entry Point (src/index.ts)

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { runOperator } from './operator';
import { runCLI } from './cli';

program
  .name('kube9-operator')
  .version(process.env.VERSION || '1.0.0')
  .description('kube9 Kubernetes Operator');

// Serve command (default)
program
  .command('serve', { isDefault: true })
  .description('Run operator control loop')
  .action(async () => {
    await runOperator();
  });

// Query command
program
  .command('query')
  .description('Query operator data')
  .addCommand(createQueryCommands());

program.parse(process.argv);
```

### CLI Module (src/cli/index.ts)

```typescript
import { Command } from 'commander';
import { queryStatus } from './commands/status';
import { queryEvents } from './commands/events';

export function createQueryCommands(): Command {
  const query = new Command('query');
  
  // query status
  query
    .command('status')
    .description('Get operator status')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(queryStatus);
  
  // query events
  const events = query
    .command('events')
    .description('Query events');
  
  // query events list
  events
    .command('list')
    .description('List events with filters')
    .option('--type <type>', 'Filter by event type')
    .option('--severity <severity>', 'Filter by severity level')
    .option('--since <date>', 'Filter events since date (ISO 8601)')
    .option('--until <date>', 'Filter events until date (ISO 8601)')
    .option('--object-kind <kind>', 'Filter by object kind')
    .option('--object-namespace <namespace>', 'Filter by object namespace')
    .option('--object-name <name>', 'Filter by object name')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--offset <number>', 'Skip number of results', '0')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(queryEvents.list);
  
  // query events get
  events
    .command('get <event-id>')
    .description('Get single event by ID')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(queryEvents.get);
  
  return query;
}

export async function runCLI() {
  // CLI commands are handled by commander action handlers
  // This function exists for explicit CLI mode if needed
}
```

### Query Status Command (src/cli/commands/status.ts)

```typescript
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { formatOutput } from '../formatters';

const StatusSchema = z.object({
  status: z.enum(['operated', 'enabled']),
  tier: z.enum(['free', 'pro']),
  version: z.string(),
  health: z.enum(['healthy', 'degraded', 'unhealthy']),
  last_update: z.string().datetime(),
});

type Status = z.infer<typeof StatusSchema>;

export async function queryStatus(options: { format: string }) {
  try {
    const db = DatabaseManager.getInstance();
    
    // Read status from database or ConfigMap
    const status: Status = await readOperatorStatus(db);
    
    // Validate with Zod
    const validated = StatusSchema.parse(status);
    
    // Format and output
    const output = formatOutput(validated, options.format);
    console.log(output);
    
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      error: 'Failed to query status',
      details: error.message,
    }));
    process.exit(1);
  }
}

async function readOperatorStatus(db: DatabaseManager): Promise<Status> {
  // Implementation reads from status storage
  // ...
}
```

### Query Events List Command (src/cli/commands/events.ts)

```typescript
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { formatOutput } from '../formatters';

const EventsListOptionsSchema = z.object({
  type: z.enum(['cluster', 'operator', 'insight', 'assessment', 'health', 'system']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  objectKind: z.string().optional(),
  objectNamespace: z.string().optional(),
  objectName: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive()),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()),
  format: z.enum(['json', 'yaml', 'table']),
});

const EventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  severity: z.string(),
  title: z.string(),
  description: z.string().optional(),
  object_kind: z.string().optional(),
  object_namespace: z.string().optional(),
  object_name: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
});

const EventsListResponseSchema = z.object({
  events: z.array(EventSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    returned: z.number(),
  }),
});

export async function listEvents(options: any) {
  try {
    // Validate options with Zod
    const validated = EventsListOptionsSchema.parse(options);
    
    // Connect to database
    const db = DatabaseManager.getInstance();
    
    // Build query
    const query = buildEventsQuery(validated);
    
    // Execute query with timeout
    const events = await executeWithTimeout(
      () => db.queryEvents(query),
      30000 // 30 second timeout
    );
    
    // Get total count for pagination
    const total = await db.countEvents(query);
    
    // Build response
    const response = EventsListResponseSchema.parse({
      events,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        returned: events.length,
      },
    });
    
    // Format and output
    const output = formatOutput(response, validated.format);
    console.log(output);
    
    process.exit(0);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify({
        error: 'Invalid arguments',
        details: error.errors,
      }));
    } else {
      console.error(JSON.stringify({
        error: 'Failed to query events',
        details: error.message,
      }));
    }
    process.exit(1);
  }
}

export async function getEvent(eventId: string, options: { format: string }) {
  try {
    const db = DatabaseManager.getInstance();
    
    const event = await db.getEventById(eventId);
    
    if (!event) {
      console.error(JSON.stringify({
        error: 'Event not found',
        event_id: eventId,
      }));
      process.exit(1);
    }
    
    const validated = EventSchema.parse(event);
    const output = formatOutput(validated, options.format);
    console.log(output);
    
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      error: 'Failed to get event',
      details: error.message,
    }));
    process.exit(1);
  }
}

export const queryEvents = {
  list: listEvents,
  get: getEvent,
};
```

### Output Formatters (src/cli/formatters.ts)

```typescript
import * as yaml from 'js-yaml';

export function formatOutput(data: any, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    
    case 'yaml':
      return yaml.dump(data, { indent: 2 });
    
    case 'table':
      return formatTable(data);
    
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function formatTable(data: any): string {
  // Table formatting for events list
  if (data.events && Array.isArray(data.events)) {
    const headers = ['ID', 'TYPE', 'SEVERITY', 'TITLE', 'CREATED'];
    const rows = data.events.map((event: any) => [
      event.id.substring(0, 26) + '...',
      event.event_type,
      event.severity,
      truncate(event.title, 40),
      new Date(event.created_at).toLocaleString(),
    ]);
    
    return renderTable(headers, rows);
  }
  
  // Table formatting for single event
  if (data.id) {
    return renderKeyValueTable(data);
  }
  
  // Fallback to JSON
  return JSON.stringify(data, null, 2);
}

function renderTable(headers: string[], rows: string[][]): string {
  const columnWidths = headers.map((h, i) => 
    Math.max(h.length, ...rows.map(r => r[i].length))
  );
  
  const headerRow = headers.map((h, i) => h.padEnd(columnWidths[i])).join('  ');
  const separator = columnWidths.map(w => '-'.repeat(w)).join('--');
  const dataRows = rows.map(row =>
    row.map((cell, i) => cell.padEnd(columnWidths[i])).join('  ')
  ).join('\n');
  
  return `${headerRow}\n${separator}\n${dataRows}`;
}

function renderKeyValueTable(data: any): string {
  const entries = Object.entries(data);
  const maxKeyLength = Math.max(...entries.map(([k]) => k.length));
  
  return entries.map(([key, value]) => {
    const formattedKey = key.padEnd(maxKeyLength);
    const formattedValue = typeof value === 'object' 
      ? JSON.stringify(value) 
      : String(value);
    return `${formattedKey} : ${formattedValue}`;
  }).join('\n');
}

function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}
```

## Query Building (src/cli/query-builder.ts)

```typescript
import { z } from 'zod';

export interface EventsQuery {
  filters: {
    event_type?: string;
    severity?: string;
    created_at_gte?: string;
    created_at_lt?: string;
    object_kind?: string;
    object_namespace?: string;
    object_name?: string;
  };
  limit: number;
  offset: number;
}

export function buildEventsQuery(options: any): EventsQuery {
  const filters: EventsQuery['filters'] = {};
  
  if (options.type) filters.event_type = options.type;
  if (options.severity) filters.severity = options.severity;
  if (options.since) filters.created_at_gte = options.since;
  if (options.until) filters.created_at_lt = options.until;
  if (options.objectKind) filters.object_kind = options.objectKind;
  if (options.objectNamespace) filters.object_namespace = options.objectNamespace;
  if (options.objectName) filters.object_name = options.objectName;
  
  return {
    filters,
    limit: options.limit,
    offset: options.offset,
  };
}
```

## Timeout Protection (src/cli/timeout.ts)

```typescript
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    ),
  ]);
}
```

## VS Code Extension Integration

### OperatorQueryClient (kube9-vscode extension)

```typescript
import * as k8s from '@kubernetes/client-node';

export class OperatorQueryClient {
  private kc: k8s.KubeConfig;
  private exec: k8s.Exec;
  
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.exec = new k8s.Exec(this.kc);
  }
  
  async queryEvents(options: EventsQueryOptions): Promise<EventsResponse> {
    // Build CLI command
    const cmd = this.buildEventsCommand(options);
    
    // Execute via kubectl exec
    const result = await this.execInOperatorPod(cmd);
    
    // Parse JSON response
    return JSON.parse(result);
  }
  
  async getEvent(eventId: string): Promise<Event> {
    const cmd = ['kube9-operator', 'query', 'events', 'get', eventId, '--format=json'];
    const result = await this.execInOperatorPod(cmd);
    return JSON.parse(result);
  }
  
  async getOperatorStatus(): Promise<OperatorStatus> {
    const cmd = ['kube9-operator', 'query', 'status', '--format=json'];
    const result = await this.execInOperatorPod(cmd);
    return JSON.parse(result);
  }
  
  private async execInOperatorPod(command: string[]): Promise<string> {
    // Find operator pod
    const podName = await this.findOperatorPod();
    
    // Execute command
    let stdout = '';
    let stderr = '';
    
    await this.exec.exec(
      'kube9-system',
      podName,
      'operator',
      command,
      process.stdout,
      process.stderr,
      process.stdin,
      false,
      (status) => {
        if (status.status !== 'Success') {
          throw new Error(`CLI command failed: ${stderr}`);
        }
      }
    );
    
    return stdout;
  }
  
  private async findOperatorPod(): Promise<string> {
    const k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    const res = await k8sApi.listNamespacedPod('kube9-system', undefined, undefined, undefined, undefined, 'app=kube9-operator');
    
    if (res.body.items.length === 0) {
      throw new Error('kube9-operator pod not found');
    }
    
    return res.body.items[0].metadata!.name!;
  }
  
  private buildEventsCommand(options: EventsQueryOptions): string[] {
    const cmd = ['kube9-operator', 'query', 'events', 'list', '--format=json'];
    
    if (options.type) cmd.push('--type', options.type);
    if (options.severity) cmd.push('--severity', options.severity);
    if (options.since) cmd.push('--since', options.since);
    if (options.limit) cmd.push('--limit', String(options.limit));
    if (options.offset) cmd.push('--offset', String(options.offset));
    
    return cmd;
  }
}
```

## Error Handling

### Exit Codes

- **0**: Success
- **1**: General error (invalid arguments, database error, etc.)
- **2**: Timeout
- **3**: Permission denied

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "details": "Technical details or stack trace",
  "code": "ERROR_CODE"
}
```

## Performance Requirements

- **CLI startup**: < 100ms
- **Query execution**: < 100ms for most queries
- **Large result sets (1000 events)**: < 500ms
- **Timeout protection**: 30 seconds maximum
- **Memory usage**: < 50MB for CLI process

## Testing Strategy

### Unit Tests
- Test command parsing with various argument combinations
- Test Zod validation for valid and invalid inputs
- Test output formatters (JSON, YAML, table)
- Test query building with filters

### Integration Tests
- Test CLI execution against real SQLite database
- Test kubectl exec integration with operator pod
- Test error handling for database failures
- Test timeout protection

### End-to-End Tests
- Test VS Code extension querying events via OperatorQueryClient
- Test concurrent CLI queries from multiple sources
- Test RBAC enforcement (positive and negative cases)

## Security Considerations

### RBAC Requirements

Users must have `pods/exec` permission in `kube9-system` namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-query-events
  namespace: kube9-system
rules:
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
```

### Input Validation

- All CLI arguments validated with Zod schemas
- SQL injection protection via parameterized queries
- Command injection protection (no shell execution)

### Output Sanitization

- Sensitive data redaction in error messages
- No stack traces in production builds
- Rate limiting for queries (future enhancement)

