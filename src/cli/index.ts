/**
 * CLI query commands
 */

import { Command } from 'commander';
import { queryStatus } from './commands/status.js';
import { listEvents, getEvent } from './commands/events.js';

/**
 * Create the query command structure
 */
export function createQueryCommands(): Command {
  const query = new Command('query')
    .description('Query operator data');
  
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
    .action(listEvents);
  
  // query events get
  events
    .command('get <eventId>')
    .description('Get single event by ID')
    .option('--format <format>', 'Output format (json|yaml|table)', 'json')
    .action(getEvent);
  
  return query;
}

