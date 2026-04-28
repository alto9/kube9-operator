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

  it('includes collections query commands', () => {
    const queryCmd = createQueryCommands();
    const names = queryCmd.commands.map((c) => c.name());
    expect(names).toContain('collections');
    expect(names).toContain('events');
    expect(names).toContain('vulnerabilities');
  });
});
