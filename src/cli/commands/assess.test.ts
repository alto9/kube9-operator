/**
 * CLI Assess Commands - Unit tests for command structure and parsing
 */

import { describe, it, expect } from 'vitest';
import { createAssessCommands } from '../index.js';

describe('createAssessCommands', () => {
  it('returns Command instance named assess', () => {
    const assessCmd = createAssessCommands();
    expect(assessCmd).toBeTruthy();
    expect(assessCmd.name()).toBe('assess');
  });

  it('has correct description', () => {
    const assessCmd = createAssessCommands();
    expect(assessCmd.description()).toContain('Well-Architected');
    expect(assessCmd.description()).toContain('assessment');
  });

  it('has run subcommand', () => {
    const assessCmd = createAssessCommands();
    const runCmd = assessCmd.commands.find((c) => c.name() === 'run');
    expect(runCmd).toBeTruthy();
    expect(runCmd?.description()).toContain('Run');
  });

  it('has list subcommand', () => {
    const assessCmd = createAssessCommands();
    const listCmd = assessCmd.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeTruthy();
    expect(listCmd?.description()).toContain('List');
  });

  it('has get subcommand', () => {
    const assessCmd = createAssessCommands();
    const getCmd = assessCmd.commands.find((c) => c.name() === 'get');
    expect(getCmd).toBeTruthy();
    expect(getCmd?.description()).toContain('Get');
  });

  it('has summary subcommand', () => {
    const assessCmd = createAssessCommands();
    const summaryCmd = assessCmd.commands.find((c) => c.name() === 'summary');
    expect(summaryCmd).toBeTruthy();
    expect(summaryCmd?.description()).toContain('summary');
  });

  it('has history subcommand', () => {
    const assessCmd = createAssessCommands();
    const historyCmd = assessCmd.commands.find((c) => c.name() === 'history');
    expect(historyCmd).toBeTruthy();
    expect(historyCmd?.description()).toContain('history');
  });

  it('run command has expected options', () => {
    const assessCmd = createAssessCommands();
    const runCmd = assessCmd.commands.find((c) => c.name() === 'run');
    expect(runCmd).toBeTruthy();
    const optionNames = runCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--mode');
    expect(optionNames).toContain('--pillar');
    expect(optionNames).toContain('--check-id');
    expect(optionNames).toContain('--format');
  });

  it('list command has filter options', () => {
    const assessCmd = createAssessCommands();
    const listCmd = assessCmd.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeTruthy();
    const optionNames = listCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--state');
    expect(optionNames).toContain('--limit');
    expect(optionNames).toContain('--since');
  });

  it('history command has filter options', () => {
    const assessCmd = createAssessCommands();
    const historyCmd = assessCmd.commands.find((c) => c.name() === 'history');
    expect(historyCmd).toBeTruthy();
    const optionNames = historyCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--pillar');
    expect(optionNames).toContain('--result');
    expect(optionNames).toContain('--limit');
    expect(optionNames).toContain('--since');
  });
});
