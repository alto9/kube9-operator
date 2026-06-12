/**
 * CLI Kubernetes AI Conformance commands
 */

import { z } from 'zod';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';
import { AiConformanceRepository } from '../../database/ai-conformance-repository.js';
import type { AiConformanceRunRecord } from '../../database/ai-conformance-contracts.js';
import { AiConformanceRunner } from '../../ai-conformance/runner.js';
import { buildBoundedRequirementSummaries } from '../../ai-conformance/summary.js';
import { kubernetesClient } from '../../kubernetes/client.js';
import { loadConfig, setConfig } from '../../config/loader.js';
import { logger } from '../../logging/logger.js';
import { formatOutput } from '../formatters.js';
import { normalizeKubernetesMinor } from '../../ai-conformance/kubernetes-version.js';

const FormatSchema = z.enum(['json', 'yaml', 'table', 'compact']).default('json');

const RunOptionsSchema = z.object({
  kubernetesMinor: z.string().optional(),
  format: FormatSchema,
});

const LatestOptionsSchema = z.object({
  format: FormatSchema,
});

const GetOptionsSchema = z.object({
  format: FormatSchema,
});

const RequirementsOptionsSchema = z.object({
  runId: z.string().optional(),
  category: z.string().optional(),
  status: z
    .enum(['passed', 'failed', 'warning', 'not-applicable', 'not-evaluated', 'needs-evidence'])
    .optional(),
  level: z.enum(['MUST', 'SHOULD']).optional(),
  format: FormatSchema,
});

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

function toApiRunRecord(record: AiConformanceRunRecord) {
  return {
    run_id: record.run_id,
    checklist_version: record.checklist_version,
    kubernetes_minor: record.kubernetes_minor,
    source_revision: record.source_revision ?? null,
    state: record.state,
    requested_at: record.requested_at,
    started_at: record.started_at ?? undefined,
    completed_at: record.completed_at ?? undefined,
    total_requirements: record.total_requirements,
    must_requirements: record.must_requirements,
    should_requirements: record.should_requirements,
    passed_count: record.passed_count,
    failed_count: record.failed_count,
    warning_count: record.warning_count,
    not_applicable_count: record.not_applicable_count,
    not_evaluated_count: record.not_evaluated_count,
    needs_evidence_count: record.needs_evidence_count,
    failure_reason: record.failure_reason ?? undefined,
  };
}

export async function aiConformanceRun(options: Record<string, unknown>) {
  try {
    const validated = RunOptionsSchema.parse(options);
    ensureDb();

    const config = await loadConfig();
    setConfig(config);

    let gitVersion: string | undefined;
    if (validated.kubernetesMinor) {
      normalizeKubernetesMinor(validated.kubernetesMinor);
    } else {
      const clusterInfo = await kubernetesClient.getClusterInfo();
      gitVersion = clusterInfo.version;
    }

    const runner = new AiConformanceRunner({
      kubernetes: kubernetesClient,
      logger,
      storage: new AiConformanceRepository(),
    });

    const record = await runner.run({
      selection: {
        gitVersion,
        options: validated.kubernetesMinor
          ? { kubernetesMinorOverride: validated.kubernetesMinor }
          : undefined,
      },
    });

    const output = formatOutput(toApiRunRecord(record), validated.format);
    console.log(output);
    process.exit(0);
  } catch (error) {
    writeError(
      'Failed to run AI conformance evaluation',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function aiConformanceLatest(options: Record<string, unknown>) {
  try {
    const validated = LatestOptionsSchema.parse(options);
    ensureDb();

    const repo = new AiConformanceRepository();
    const summary = repo.buildLatestSummary();
    const output = formatOutput(summary, validated.format);
    console.log(output);
    process.exit(0);
  } catch (error) {
    writeError(
      'Failed to load latest AI conformance summary',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function aiConformanceGet(runId: string, options: Record<string, unknown>) {
  try {
    const validated = GetOptionsSchema.parse(options);
    ensureDb();

    const repo = new AiConformanceRepository();
    const record = repo.getRunById(runId);
    if (!record) {
      writeError(`AI conformance run not found: ${runId}`);
      return;
    }

    const output = formatOutput(toApiRunRecord(record), validated.format);
    console.log(output);
    process.exit(0);
  } catch (error) {
    writeError(
      'Failed to get AI conformance run',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function aiConformanceRequirements(options: Record<string, unknown>) {
  try {
    const validated = RequirementsOptionsSchema.parse(options);
    ensureDb();

    const repo = new AiConformanceRepository();
    let runId = validated.runId;
    if (!runId) {
      const latest = repo.getLatestRun();
      if (!latest) {
        writeError('No AI conformance runs found');
        return;
      }
      runId = latest.run_id;
    }

    let rows = repo.getRequirementResultsForRun(runId);
    if (validated.category) {
      rows = rows.filter((row) => row.category === validated.category);
    }
    if (validated.status) {
      rows = rows.filter((row) => row.status === validated.status);
    }
    if (validated.level) {
      rows = rows.filter((row) => row.level === validated.level);
    }

    const requirements = buildBoundedRequirementSummaries(rows);
    const output = formatOutput({ run_id: runId, requirements }, validated.format);
    console.log(output);
    process.exit(0);
  } catch (error) {
    writeError(
      'Failed to list AI conformance requirement results',
      error instanceof Error ? error.message : String(error)
    );
  }
}
