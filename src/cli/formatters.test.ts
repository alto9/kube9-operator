import { describe, it, expect } from 'vitest';
import { formatOutput } from './formatters.js';

describe('formatOutput', () => {
  it('formats as JSON with 2-space indentation', () => {
    const data = { key: 'value', nested: { data: 123 } };
    const result = formatOutput(data, 'json');
    
    expect(result).toContain('  ');
    expect(JSON.parse(result).key).toBe('value');
  });

  it('formats as YAML', () => {
    const data = { key: 'value', number: 123 };
    const result = formatOutput(data, 'yaml');
    
    expect(result).toContain('key: value');
    expect(result).toContain('number: 123');
  });

  it('formats single object as key-value table', () => {
    const data = { status: 'healthy', tier: 'pro', version: '1.0.0' };
    const result = formatOutput(data, 'table');
    
    expect(result).toContain('status');
    expect(result).toContain('healthy');
    expect(result).toContain(':');
  });

  it('formats events list as table', () => {
    const data = {
      events: [
        { id: 'evt1', event_type: 'cluster', severity: 'info', title: 'Test Event', created_at: '2025-01-01T10:00:00Z' },
        { id: 'evt2', event_type: 'operator', severity: 'warning', title: 'Another Event', created_at: '2025-01-01T11:00:00Z' }
      ]
    };
    
    const result = formatOutput(data, 'table');
    
    expect(result).toContain('ID');
    expect(result).toContain('TYPE');
    expect(result).toContain('SEVERITY');
    expect(result).toContain('evt1');
    expect(result).toContain('cluster');
  });

  it('table has separator line', () => {
    const data = {
      events: [
        { id: 'evt1', event_type: 'cluster', severity: 'info', title: 'Test', created_at: '2025-01-01T10:00:00Z' }
      ]
    };
    
    const result = formatOutput(data, 'table');
    const lines = result.split('\n');
    
    expect(lines.some(line => line.includes('---'))).toBe(true);
  });

  it('truncates long strings in table', () => {
    const longTitle = 'x'.repeat(100);
    const data = {
      events: [
        { id: 'evt1', event_type: 'cluster', severity: 'info', title: longTitle, created_at: '2025-01-01T10:00:00Z' }
      ]
    };
    
    const result = formatOutput(data, 'table');
    
    expect(result).toContain('...');
    expect(result).not.toContain('x'.repeat(50));
  });

  it('formats date in table', () => {
    const data = {
      events: [
        { id: 'evt1', event_type: 'cluster', severity: 'info', title: 'Test', created_at: '2025-01-01T10:30:45Z' }
      ]
    };
    
    const result = formatOutput(data, 'table');
    
    expect(result).toContain('2025-01-01');
    expect(result).toContain('10:30:45');
  });

  it('handles empty events array', () => {
    const data = { events: [] };
    const result = formatOutput(data, 'table');
    
    expect(result).toBe('No results found');
  });

  it('throws error for unsupported format', () => {
    const data = { key: 'value' };
    
    expect(() => formatOutput(data, 'xml')).toThrow(/Unsupported format: xml/);
  });

  it('handles nested objects in key-value table', () => {
    const data = {
      name: 'test',
      metadata: { nested: 'value' }
    };
    
    const result = formatOutput(data, 'table');
    
    expect(result).toContain('metadata');
    expect(result).toContain('nested');
  });

  it('aligns columns in table', () => {
    const data = {
      events: [
        { id: 'short', event_type: 'cluster', severity: 'info', title: 'Test', created_at: '2025-01-01T10:00:00Z' },
        { id: 'very_long_id_here', event_type: 'operator', severity: 'warning', title: 'Test2', created_at: '2025-01-01T11:00:00Z' }
      ]
    };
    
    const result = formatOutput(data, 'table');
    const lines = result.split('\n');
    
    // All data rows should have same structure (aligned columns)
    const dataLines = lines.slice(2); // Skip header and separator
    expect(dataLines.every(line => line.includes('  '))).toBe(true);
  });

  it('JSON output is parseable', () => {
    const data = { key: 'value', number: 123, bool: true };
    const result = formatOutput(data, 'json');
    
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
  });

  it('YAML output is parseable', async () => {
    const yaml = await import('js-yaml');
    const data = { key: 'value', number: 123 };
    const result = formatOutput(data, 'yaml');

    const parsed = yaml.load(result);
    expect(parsed).toEqual(data);
  });

  it('formats assessments list as table', () => {
    const data = {
      assessments: [
        {
          run_id: 'run-1',
          mode: 'full',
          state: 'completed',
          total_checks: 10,
          passed_checks: 8,
          failed_checks: 2,
          requested_at: '2025-01-01T10:00:00Z',
        },
      ],
    };

    const result = formatOutput(data, 'table');

    expect(result).toContain('RUN_ID');
    expect(result).toContain('MODE');
    expect(result).toContain('STATE');
    expect(result).toContain('run-1');
    expect(result).toContain('full');
    expect(result).toContain('completed');
  });

  it('formats assessment history as table', () => {
    const data = {
      history: [
        {
          id: 'hist-1',
          run_id: 'run-1',
          check_id: 'security.pod-security',
          pillar: 'security',
          status: 'passing',
          assessed_at: '2025-01-01T10:00:00Z',
        },
      ],
    };

    const result = formatOutput(data, 'table');

    expect(result).toContain('CHECK_ID');
    expect(result).toContain('PILLAR');
    expect(result).toContain('STATUS');
    expect(result).toContain('security');
    expect(result).toContain('passing');
  });

  it('supports compact format', () => {
    const data = {
      assessments: [
        {
          run_id: 'run-1',
          mode: 'full',
          state: 'completed',
          total_checks: 5,
          passed_checks: 5,
          failed_checks: 0,
          requested_at: '2025-01-01T10:00:00Z',
        },
      ],
    };

    const result = formatOutput(data, 'compact');

    expect(result).toContain('RUN_ID');
    expect(result).toContain('run-1');
    expect(result).toContain('completed');
  });

  it('handles empty assessments array', () => {
    const data = { assessments: [] };
    const result = formatOutput(data, 'table');

    expect(result).toBe('No results found');
  });

  it('handles empty history array', () => {
    const data = { history: [] };
    const result = formatOutput(data, 'table');

    expect(result).toBe('No results found');
  });
});
