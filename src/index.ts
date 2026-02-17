#!/usr/bin/env node
/**
 * kube9-operator CLI entry point
 */

import { program } from 'commander';
import { createQueryCommands, createAssessCommands } from './cli/index.js';
import { getConfig } from './config/loader.js';
import type { Config } from './config/types.js';

const VERSION = process.env.VERSION || '0.0.1';

program
  .name('kube9-operator')
  .version(VERSION)
  .description('kube9 Kubernetes Operator');

// Serve command (default) - runs the operator control loop
program
  .command('serve', { isDefault: true })
  .description('Run operator control loop')
  .action(async () => {
    const { startOperator } = await import('./operator.js');
    await startOperator();
  });

// Query command - CLI queries
program.addCommand(createQueryCommands());

// Assess command - Well-Architected Framework assessment
program.addCommand(createAssessCommands());

program.parse(process.argv);

// Export config singleton
export { getConfig };
export type { Config };
