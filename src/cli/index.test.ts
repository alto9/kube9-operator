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
    expect(names).toContain('argocd');
    expect(names).toContain('events');
    expect(names).toContain('vulnerabilities');
  });

  it('includes argocd resource-tree get subcommand', () => {
    const queryCmd = createQueryCommands();
    const argocd = queryCmd.commands.find((c) => c.name() === 'argocd');
    expect(argocd).toBeTruthy();
    const resourceTree = argocd!.commands.find((c) => c.name() === 'resource-tree');
    expect(resourceTree).toBeTruthy();
    const getCmd = resourceTree!.commands.find((c) => c.name() === 'get');
    expect(getCmd).toBeTruthy();
  });
});
