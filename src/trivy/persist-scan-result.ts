/**
 * Persist Trivy JSON report rows into image_scans / image_vulnerabilities.
 */

import { randomUUID } from 'crypto';
import type { TrivyImageReport } from './scanner.js';
import { ImageScanRepository } from '../database/image-scan-repository.js';
import type { ImageVulnerabilityInput } from '../database/image-scan-contracts.js';

export interface PersistTrivyReportOptions {
  imageRef: string;
  report: TrivyImageReport;
  repo?: ImageScanRepository;
  /** Defaults to a new UUID */
  scanId?: string;
  startedAt?: string;
  completedAt?: string;
}

function normalizeSeverity(raw: string | undefined): string {
  if (!raw || raw.trim() === '') {
    return 'unknown';
  }
  return raw.trim().toLowerCase();
}

/**
 * Walk Trivy JSON Results[].Vulnerabilities and build normalized rows.
 */
export function vulnerabilitiesFromTrivyReport(
  scanId: string,
  report: TrivyImageReport
): ImageVulnerabilityInput[] {
  const results = Array.isArray(report.Results) ? report.Results : [];
  const rows: ImageVulnerabilityInput[] = [];
  let idx = 0;

  for (const block of results) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const vulns = (block as { Vulnerabilities?: unknown }).Vulnerabilities;
    if (!Array.isArray(vulns)) {
      continue;
    }
    for (const v of vulns) {
      if (!v || typeof v !== 'object') {
        continue;
      }
      const o = v as Record<string, unknown>;
      const vid = String(o.VulnerabilityID ?? o.vulnerability_id ?? o.VulnerabilityId ?? '');
      if (!vid) {
        continue;
      }
      const severity = normalizeSeverity(
        typeof o.Severity === 'string' ? o.Severity : typeof o.severity === 'string' ? o.severity : undefined
      );
      const pkg =
        typeof o.PkgName === 'string'
          ? o.PkgName
          : typeof o.pkg_name === 'string'
            ? o.pkg_name
            : null;
      const installed =
        typeof o.InstalledVersion === 'string'
          ? o.InstalledVersion
          : typeof o.installed_version === 'string'
            ? o.installed_version
            : null;
      const fixed =
        typeof o.FixedVersion === 'string'
          ? o.FixedVersion
          : typeof o.fixed_version === 'string'
            ? o.fixed_version
            : null;
      const title = typeof o.Title === 'string' ? o.Title : typeof o.title === 'string' ? o.title : null;
      idx += 1;
      rows.push({
        id: `${scanId}-v-${idx}-${vid}`,
        scan_id: scanId,
        vulnerability_id: vid,
        severity,
        package_name: pkg,
        installed_version: installed,
        fixed_version: fixed,
        title,
        raw_metadata: JSON.stringify(o),
      });
    }
  }

  return rows;
}

/**
 * Upsert a completed scan and replace vulnerability rows for that scan.
 */
export function persistTrivyReportToDatabase(options: PersistTrivyReportOptions): string {
  const repo = options.repo ?? new ImageScanRepository();
  const scanId = options.scanId ?? randomUUID();
  const now = options.completedAt ?? new Date().toISOString();
  const startedAt = options.startedAt ?? now;

  repo.upsertScan({
    scan_id: scanId,
    image_reference: options.imageRef,
    image_digest: null,
    started_at: startedAt,
    completed_at: now,
    state: 'completed',
    scanner: 'trivy',
    error_message: null,
  });

  const rows = vulnerabilitiesFromTrivyReport(scanId, options.report);
  repo.replaceVulnerabilitiesForScan(scanId, rows);
  return scanId;
}
