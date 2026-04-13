/**
 * CLI: query stored image vulnerabilities (from Trivy-backed scans).
 */

import { z } from 'zod';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';
import {
  ImageScanRepository,
  type ImageVulnerabilityFilters,
} from '../../database/image-scan-repository.js';
import { formatOutput } from '../formatters.js';
import { trivyStatusTracker } from '../../trivy/state.js';

function writeError(message: string, details?: string) {
  const err = details ? { error: message, details } : { error: message };
  console.error(JSON.stringify(err));
  process.exit(1);
}

function ensureDb() {
  DatabaseManager.getInstance();
  const schema = new SchemaManager();
  schema.initialize();
}

const ListOptionsSchema = z.object({
  severity: z.string().optional(),
  imageReference: z.string().optional(),
  vulnerabilityId: z.string().optional(),
  scanId: z.string().optional(),
  completedFrom: z.string().optional(),
  completedTo: z.string().optional(),
  limit: z
    .string()
    .default('100')
    .transform(Number)
    .pipe(z.number().int().positive().max(5000)),
  offset: z
    .string()
    .default('0')
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

const SummaryOptionsSchema = z.object({
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

export async function listVulnerabilities(options: Record<string, unknown>) {
  try {
    const validated = ListOptionsSchema.parse(options);
    ensureDb();

    const trivy = trivyStatusTracker.getStatus();
    const scanningAvailable = Boolean(trivy.detected && trivy.serverUrl);

    const filters: ImageVulnerabilityFilters = {};
    if (validated.severity) {
      filters.severity = validated.severity
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
    if (validated.imageReference) {
      filters.image_reference = validated.imageReference;
    }
    if (validated.vulnerabilityId) {
      filters.vulnerability_id = validated.vulnerabilityId;
    }
    if (validated.scanId) {
      filters.scan_id = validated.scanId;
    }
    if (validated.completedFrom) {
      filters.completed_from = validated.completedFrom;
    }
    if (validated.completedTo) {
      filters.completed_to = validated.completedTo;
    }

    const repo = new ImageScanRepository();
    const rows = repo.queryVulnerabilities({
      filters,
      limit: validated.limit,
      offset: validated.offset,
    });
    const total = repo.countVulnerabilities(filters);

    const result = {
      scanning_available: scanningAvailable,
      message: scanningAvailable
        ? undefined
        : 'Vulnerability scanning is unavailable (Trivy not detected or unreachable); listing stored findings only.',
      vulnerabilities: rows,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        returned: rows.length,
      },
    };

    console.log(formatOutput(result, validated.format));
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      writeError('Invalid arguments', first?.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to list vulnerabilities', msg);
  }
}

export async function summarizeVulnerabilities(options: Record<string, unknown>) {
  try {
    const validated = SummaryOptionsSchema.parse(options);
    ensureDb();

    const trivy = trivyStatusTracker.getStatus();
    const repo = new ImageScanRepository();
    const grouped = repo.countVulnerabilitiesGroupedBySeverity();
    const total = Object.values(grouped).reduce((a, b) => a + b, 0);

    const summary = {
      scanning_available: Boolean(trivy.detected && trivy.serverUrl),
      total_findings: total,
      by_severity: grouped,
      trivy: {
        detected: trivy.detected,
        server_url: trivy.serverUrl,
      },
    };

    if (!summary.scanning_available) {
      (summary as { message?: string }).message =
        'Vulnerability scanning is unavailable (Trivy not detected or unreachable). Summary reflects stored data only.';
    }

    console.log(formatOutput(summary, validated.format));
    process.exit(0);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0];
      writeError('Invalid arguments', first?.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError('Failed to summarize vulnerabilities', msg);
  }
}
