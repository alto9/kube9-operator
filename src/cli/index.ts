/**
 * CLI query commands
 */

import { Command } from 'commander';
import { queryStatus } from './commands/status.js';
import { listEvents, getEvent } from './commands/events.js';
import {
  assessRun,
  assessList,
  assessGet,
  assessSummary,
  assessHistory,
} from './commands/assess.js';

/**
 * Create the assess command structure
 */
export function createAssessCommands(): Command {
  const assess = new Command('assess')
    .description('Well-Architected Framework assessment commands');

  // assess run
  assess
    .command('run')
    .description('Run an assessment')
    .option('--mode <mode>', 'Run mode: full, pillar, single-check', 'full')
    .option('--pillar <pillar>', 'Pillar filter (required when mode=pillar)')
    .option('--check-id <id>', 'Check ID filter (required when mode=single-check)')
    .option('--timeout-ms <ms>', 'Per-check timeout in milliseconds', '30000')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(assessRun);

  // assess list
  assess
    .command('list')
    .description('List assessment runs')
    .option('--state <state>', 'Filter by state: queued, running, completed, failed, partial')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--since <date>', 'Filter since date (ISO 8601)')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(assessList);

  // assess get
  assess
    .command('get <assessmentId>')
    .description('Get single assessment by run ID')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(assessGet);

  // assess summary
  assess
    .command('summary')
    .description('Get assessment summary')
    .option('--since <date>', 'Filter since date (ISO 8601)')
    .option('--limit <number>', 'Number of recent runs to aggregate', '50')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(assessSummary);

  // assess history
  assess
    .command('history')
    .description('List assessment check history')
    .option('--pillar <pillar>', 'Filter by pillar')
    .option('--result <result>', `Filter by result: passing, failing, warning, skipped, error, timeout`)
    .option('--severity <severity>', 'Filter by severity')
    .option('--limit <number>', 'Limit number of results', '100')
    .option('--since <date>', 'Filter since date (ISO 8601)')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(assessHistory);

  return assess;
}

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

