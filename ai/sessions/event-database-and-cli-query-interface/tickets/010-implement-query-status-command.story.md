---
story_id: 010-implement-query-status-command
session_id: event-database-and-cli-query-interface
feature_id: [cli-query-interface]
spec_id: [cli-architecture-spec]
status: pending
---

# Story: Implement Query Status Command

## Objective

Implement the `kube9-operator query status` CLI command that returns operator status information.

## Acceptance Criteria

- [ ] `query status` command registered
- [ ] Reads operator status from ConfigMap or database
- [ ] Returns JSON with status, tier, version, health, last_update
- [ ] Validates response with Zod schema
- [ ] Supports `--format` flag (json, yaml, table)
- [ ] Exits with code 0 on success, 1 on error

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/cli/commands/status.ts`

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/cli/index.ts`

## Implementation Notes

### Update src/cli/index.ts

```typescript
import { Command } from 'commander';
import { queryStatus } from './commands/status.js';

export function createQueryCommands(): Command {
  const query = new Command('query')
    .description('Query operator data');
  
  // query status
  query
    .command('status')
    .description('Get operator status')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(queryStatus);
  
  return query;
}
```

### Create src/cli/commands/status.ts

```typescript
import { z } from 'zod';
import { formatOutput } from '../formatters.js';
import { KubernetesClient } from '../../kubernetes/client.js';

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
    // Read status from ConfigMap
    const k8sClient = new KubernetesClient();
    const configMap = await k8sClient.readConfigMap('kube9-operator-status');
    
    if (!configMap || !configMap.data) {
      throw new Error('Status ConfigMap not found');
    }
    
    // Parse and validate status
    const status: Status = {
      status: configMap.data.status as any,
      tier: configMap.data.tier as any,
      version: configMap.data.version,
      health: configMap.data.health as any,
      last_update: configMap.data.last_update,
    };
    
    const validated = StatusSchema.parse(status);
    
    // Format and output
    const output = formatOutput(validated, options.format);
    console.log(output);
    
    process.exit(0);
  } catch (error: any) {
    console.error(JSON.stringify({
      error: 'Failed to query status',
      details: error.message,
    }));
    process.exit(1);
  }
}
```

## Estimated Time

< 25 minutes

## Dependencies

- Story 003 (CLI entry point must exist)
- Needs formatOutput function (created in next story)

