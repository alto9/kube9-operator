---
story_id: 003-create-cli-entry-point
session_id: event-database-and-cli-query-interface
feature_id: [cli-query-interface]
spec_id: [cli-architecture-spec]
status: pending
---

# Story: Create CLI Entry Point with Command Routing

## Objective

Create the CLI entry point in `src/index.ts` that routes between `serve` mode (operator loop) and `query` mode (CLI queries).

## Acceptance Criteria

- [ ] `src/index.ts` sets up commander program
- [ ] Default command is `serve` (runs operator)
- [ ] `query` command is registered (subcommands added later)
- [ ] `--version` flag displays version
- [ ] `--help` flag displays usage information
- [ ] Operator can still run without arguments (defaults to serve mode)

## Files to Create/Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/index.ts` (modify)
- `/home/danderson/code/alto9/opensource/kube9-operator/src/cli/index.ts` (create)

## Implementation Notes

### Update src/index.ts

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { createQueryCommands } from './cli/index.js';

const VERSION = process.env.VERSION || '0.0.1';

program
  .name('kube9-operator')
  .version(VERSION)
  .description('kube9 Kubernetes Operator');

// Serve command (default)
program
  .command('serve', { isDefault: true })
  .description('Run operator control loop')
  .action(async () => {
    const { startOperator } = await import('./operator.js');
    await startOperator();
  });

// Query command (structure, subcommands added in later stories)
program.addCommand(createQueryCommands());

program.parse(process.argv);
```

### Create src/cli/index.ts

```typescript
import { Command } from 'commander';

export function createQueryCommands(): Command {
  const query = new Command('query')
    .description('Query operator data');
  
  // Subcommands will be added in later stories
  // - query status
  // - query events list
  // - query events get
  
  return query;
}
```

## Estimated Time

< 20 minutes

## Dependencies

- Story 001 (commander must be installed)

