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
import { listVulnerabilities, summarizeVulnerabilities } from './commands/vulnerabilities.js';
import { listCollections, getCollection } from './commands/collections.js';
import { listArgoCDApplications, getArgoCDApplication } from './commands/argocd-apps.js';

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

  const vulnerabilities = query
    .command('vulnerabilities')
    .description('Query stored image vulnerability findings (Trivy)');

  vulnerabilities
    .command('list')
    .description('List vulnerabilities with optional filters')
    .option('--severity <levels>', 'Comma-separated severities (e.g. critical,high)')
    .option('--image-reference <ref>', 'Filter by scanned image reference')
    .option('--vulnerability-id <id>', 'Filter by CVE/advisory id')
    .option('--scan-id <id>', 'Filter by scan id')
    .option('--completed-from <iso>', 'Completed on/after (ISO 8601)')
    .option('--completed-to <iso>', 'Completed on/before (ISO 8601)')
    .option('--limit <number>', 'Limit results', '100')
    .option('--offset <number>', 'Offset', '0')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(listVulnerabilities);

  vulnerabilities
    .command('summary')
    .description('Summary counts by severity from stored findings')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(summarizeVulnerabilities);

  const collections = query
    .command('collections')
    .description('Query persisted M8 collection payloads (SQLite)');

  collections
    .command('list')
    .description('List stored collections')
    .option(
      '--type <type>',
      'Filter by type: cluster-metadata, resource-inventory, resource-configuration-patterns'
    )
    .option('--cluster-id <id>', 'Filter by cluster id')
    .option('--since <date>', 'Collected on/after (ISO 8601)')
    .option('--until <date>', 'Collected before (ISO 8601)')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--offset <number>', 'Skip number of results', '0')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(listCollections);

  collections
    .command('get <collectionId>')
    .description('Get full collection payload by id')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(getCollection);

  const argocd = query
    .command('argocd')
    .description('Query persisted Argo CD Application snapshots (SQLite)');

  const argocdApps = argocd
    .command('apps')
    .description('List or get stored Application snapshots');

  argocdApps
    .command('list')
    .description('List stored Argo CD Applications from argocd_apps')
    .option('--cluster-id <id>', 'Filter by cluster id')
    .option('--namespace <ns>', 'Filter by application namespace')
    .option('--name <name>', 'Filter by application name')
    .option('--since <date>', 'Collected on/after (ISO 8601)')
    .option('--until <date>', 'Collected before (ISO 8601)')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--offset <number>', 'Skip number of results', '0')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(listArgoCDApplications);

  argocdApps
    .command('get <clusterId> <namespace> <name>')
    .description('Get one persisted Application snapshot by primary key')
    .option('--format <format>', 'Output format (json|yaml|table|compact)', 'json')
    .action(getArgoCDApplication);

  return query;
}

