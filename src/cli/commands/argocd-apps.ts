/**
 * CLI: query persisted Argo CD Application snapshots (M9).
 */

import { z } from 'zod';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';
import {
  ArgoCDAppsRepository,
  type ArgoCDAppFilters,
} from '../../database/argocd-apps-repository.js';
import { formatOutput } from '../formatters.js';

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
  clusterId: z.string().optional(),
  namespace: z.string().optional(),
  name: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z
    .string()
    .default('50')
    .transform(Number)
    .pipe(z.number().int().positive().max(1000)),
  offset: z
    .string()
    .default('0')
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

const GetOptionsSchema = z.object({
  format: z.enum(['json', 'yaml', 'table', 'compact']).default('json'),
});

export async function listArgoCDApplications(options: Record<string, unknown>) {
  try {
    const validated = ListOptionsSchema.parse(options);
    ensureDb();

    const filters: ArgoCDAppFilters = {};
    if (validated.clusterId) {
      filters.cluster_id = validated.clusterId;
    }
    if (validated.namespace) {
      filters.app_namespace = validated.namespace;
    }
    if (validated.name) {
      filters.app_name = validated.name;
    }
    if (validated.since) {
      filters.observed_at_gte = validated.since;
    }
    if (validated.until) {
      filters.observed_at_lt = validated.until;
    }

    const repo = new ArgoCDAppsRepository();
    const applications = repo.listApplications({
      filters,
      limit: validated.limit,
      offset: validated.offset,
    });
    const total = repo.countApplications(filters);

    const result = {
      applications,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        returned: applications.length,
      },
    };

    console.log(formatOutput(result, validated.format));
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    writeError('Failed to list Argo CD applications', err.message);
  }
}

export async function getArgoCDApplication(
  clusterId: string,
  namespace: string,
  name: string,
  options: Record<string, unknown>
) {
  try {
    const validated = GetOptionsSchema.parse(options);
    ensureDb();

    const repo = new ArgoCDAppsRepository();
    const snapshot = repo.getApplicationSnapshot(clusterId, namespace, name);
    if (!snapshot) {
      console.error(
        JSON.stringify({
          error: 'Argo CD application snapshot not found',
          cluster_id: clusterId,
          app_namespace: namespace,
          app_name: name,
        })
      );
      process.exit(1);
    }

    console.log(formatOutput(snapshot, validated.format));
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    writeError('Failed to get Argo CD application', err.message);
  }
}
