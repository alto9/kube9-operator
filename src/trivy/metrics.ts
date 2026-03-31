/**
 * Prometheus metrics for vulnerability scanning (M3).
 * Registered on the shared operator registry; safe when Trivy is absent (gauges stay at zero).
 */

import { Gauge, Histogram } from 'prom-client';
import { register } from '../collection/metrics.js';
import { ImageScanRepository } from '../database/image-scan-repository.js';
import { logger } from '../logging/logger.js';

const SEVERITY_LABELS = ['critical', 'high', 'medium', 'low', 'unknown', 'info', 'other'] as const;

/**
 * Current vulnerability row counts in SQLite, by normalized severity label.
 */
export const vulnerabilityFindingsBySeverity = new Gauge({
  name: 'kube9_operator_vulnerability_findings',
  help: 'Count of stored vulnerability rows in the local database by severity',
  labelNames: ['severity'],
  registers: [register],
});

/**
 * Whether Trivy integration is active (1) or not (0).
 */
export const scanningActive = new Gauge({
  name: 'kube9_operator_scanning_active',
  help: '1 when Trivy server is detected and available, else 0',
  registers: [register],
});

/**
 * Duration of a single image scan attempt, or a skipped cycle segment.
 * Labels: outcome = success | failed | skipped
 */
export const imageScanDurationSeconds = new Histogram({
  name: 'kube9_operator_image_scan_duration_seconds',
  help: 'Duration of Trivy image scan attempts in seconds',
  labelNames: ['outcome'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [register],
});

function ensureSeverityLabel(sev: string): (typeof SEVERITY_LABELS)[number] {
  const s = sev.toLowerCase();
  if ((SEVERITY_LABELS as readonly string[]).includes(s)) {
    return s as (typeof SEVERITY_LABELS)[number];
  }
  return 'other';
}

/**
 * Refresh severity gauges from the database (completed scans only).
 */
export function refreshVulnerabilityMetrics(repo?: ImageScanRepository): void {
  try {
    const r = repo ?? new ImageScanRepository();
    const grouped = r.countVulnerabilitiesGroupedBySeverity();
    const totals: Record<string, number> = {};
    for (const label of SEVERITY_LABELS) {
      totals[label] = 0;
    }
    for (const [sev, count] of Object.entries(grouped)) {
      const lab = ensureSeverityLabel(sev);
      totals[lab] = (totals[lab] ?? 0) + count;
    }
    for (const label of SEVERITY_LABELS) {
      vulnerabilityFindingsBySeverity.set({ severity: label }, totals[label] ?? 0);
    }
  } catch (err) {
    logger.warn('Failed to refresh vulnerability metrics from database', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function setScanningActiveGauge(active: boolean): void {
  scanningActive.set(active ? 1 : 0);
}

export function recordImageScanDurationSeconds(
  outcome: 'success' | 'failed' | 'skipped',
  seconds: number
): void {
  try {
    imageScanDurationSeconds.observe({ outcome }, seconds);
  } catch (err) {
    logger.warn('Failed to record image scan duration metric', {
      outcome,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
