import { describe, it, expect } from 'vitest';
import { createQueryCommands } from './index.js';

describe('createQueryCommands', () => {
  it('returns Command instance', () => {
    const queryCmd = createQueryCommands();
    
    expect(queryCmd).toBeTruthy();
    expect(queryCmd.name()).toBe('query');
  });

  it('has correct description', () => {
    const queryCmd = createQueryCommands();
    
    expect(queryCmd.description()).toBe('Query operator data');
  });

  it('structure is extensible', () => {
    const queryCmd = createQueryCommands();
    
    // Verify it's a Command instance with commands array
    expect('commands' in queryCmd).toBe(true);
    
    // Initially should have no subcommands (they will be added in later stories)
    const subcommands = queryCmd.commands;
    expect(Array.isArray(subcommands)).toBe(true);
  });
});
