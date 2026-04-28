/**
 * CLI: query persisted collection payloads (M8).
 */

import { z } from 'zod';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';
import {
  CollectionRepository,
  type CollectionFilters,
  type CollectionRowType,
} from '../../database/collection-repository.js';
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

const collectionTypeEnum = z.enum([
  'cluster-metadata',
  'resource-inventory',
  'resource-configuration-patterns',
]);

const ListOptionsSchema = z.object({
  type: collectionTypeEnum.optional(),
  clusterId: z.string().optional(),
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

export async function listCollections(options: Record<string, unknown>) {
  try {
    const validated = ListOptionsSchema.parse(options);
    ensureDb();

    const filters: CollectionFilters = {};
    if (validated.type) {
      filters.type = validated.type as CollectionRowType;
    }
    if (validated.clusterId) {
      filters.cluster_id = validated.clusterId;
    }
    if (validated.since) {
      filters.collected_at_gte = validated.since;
    }
    if (validated.until) {
      filters.collected_at_lt = validated.until;
    }

    const repo = new CollectionRepository();
    const collections = repo.queryCollectionSummaries({
      filters,
      limit: validated.limit,
      offset: validated.offset,
    });
    const total = repo.countCollections(filters);

    const result = {
      collections,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        returned: collections.length,
      },
    };

    console.log(formatOutput(result, validated.format));
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    writeError('Failed to list collections', err.message);
  }
}

export async function getCollection(collectionId: string, options: Record<string, unknown>) {
  try {
    const validated = GetOptionsSchema.parse(options);
    ensureDb();

    const repo = new CollectionRepository();
    const payload = repo.getCollectionById(collectionId);
    if (!payload) {
      console.error(
        JSON.stringify({
          error: 'Collection not found',
          collection_id: collectionId,
        })
      );
      process.exit(1);
    }

    console.log(formatOutput(payload, validated.format));
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    writeError('Failed to get collection', err.message);
  }
}
