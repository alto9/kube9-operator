import { describe, it, expect } from 'vitest';
import { vulnerabilitiesFromTrivyReport } from './persist-scan-result.js';

describe('vulnerabilitiesFromTrivyReport', () => {
  it('extracts rows from Trivy JSON', () => {
    const report = {
      Results: [
        {
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2024-1',
              Severity: 'HIGH',
              PkgName: 'openssl',
              InstalledVersion: '1.0',
              FixedVersion: '1.1',
              Title: 'test',
            },
          ],
        },
      ],
    };
    const rows = vulnerabilitiesFromTrivyReport('scan-a', report);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.vulnerability_id).toBe('CVE-2024-1');
    expect(rows[0]?.severity).toBe('high');
    expect(rows[0]?.scan_id).toBe('scan-a');
  });

  it('returns empty for empty results', () => {
    expect(vulnerabilitiesFromTrivyReport('s', {})).toEqual([]);
  });
});
