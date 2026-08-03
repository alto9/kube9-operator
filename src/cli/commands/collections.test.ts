/**
 * CLI Collections Commands - structure, validation, and list/get round-trips
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { createQueryCommands } from '../index.js';
import { listCollections, getCollection } from './collections.js';
import { SchemaManager } from '../../database/schema.js';
import { DatabaseManager } from '../../database/manager.js';
import { CollectionRepository } from '../../database/collection-repository.js';
import type { CollectionPayload } from '../../collection/types.js';

const testDbDir = path.join(process.cwd(), 'test-collections-cli-temp');
const FIVE_TYPE_TOKENS = [
  'cluster-metadata',
  'resource-inventory',
  'resource-configuration-patterns',
  'performance-metrics',
  'security-posture',
] as const;

function performancePayload(id: string): CollectionPayload {
  const ts = new Date().toISOString();
  return {
    version: 'v1.0.0',
    type: 'performance-metrics',
    data: {
      timestamp: ts,
      collectionId: id,
      clusterId: 'cls_testabc1234567890123456789012',
      source: { available: true },
      utilization: { cpu: { clusterAvgRatio: 0.42 } },
    },
    sanitization: { rulesApplied: ['hash-identifiers'], timestamp: ts },
  };
}

function securityPosturePayload(id: string): CollectionPayload {
  const ts = new Date().toISOString();
  return {
    version: 'v1.0.0',
    type: 'security-posture',
    data: {
      timestamp: ts,
      collectionId: id,
      clusterId: 'cls_testabc1234567890123456789012',
      privilegedHost: {
        privilegedContainers: 2,
        hostPathVolumes: 1,
        hostNetworkPods: 0,
      },
      networkPolicyCoverage: {
        namespacesTotal: 8,
        namespacesWithNetworkPolicy: 4,
      },
      nsaCisRollups: {
        allowPrivilegeEscalationTrueContainers: 0,
        runAsNonRootFalseContainers: 1,
        readOnlyRootFilesystemFalseContainers: 0,
        capabilitiesNotDroppedAllContainers: 0,
        automountServiceAccountTokenTruePods: 0,
        hostNamespacesPods: 0,
      },
    },
    sanitization: { rulesApplied: ['hash-identifiers'], timestamp: ts },
  };
}

function mockExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    if (code !== 0 && code !== undefined) {
      throw new Error(`process.exit:${code}`);
    }
  }) as typeof process.exit);
}

describe('createQueryCommands collections', () => {
  it('registers collections list and get subcommands', () => {
    const queryCmd = createQueryCommands();
    const collectionsCmd = queryCmd.commands.find((c) => c.name() === 'collections');
    expect(collectionsCmd).toBeTruthy();
    const names = collectionsCmd!.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('get');
  });

  it('list --type help documents all five collection type tokens', () => {
    const queryCmd = createQueryCommands();
    const collectionsCmd = queryCmd.commands.find((c) => c.name() === 'collections');
    const listCmd = collectionsCmd!.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeTruthy();
    const typeOpt = listCmd!.options.find((o) => o.long === '--type');
    expect(typeOpt).toBeTruthy();
    const desc = typeOpt!.description;
    for (const token of FIVE_TYPE_TOKENS) {
      expect(desc).toContain(token);
    }
  });

  it('list command exposes filter and format options', () => {
    const queryCmd = createQueryCommands();
    const collectionsCmd = queryCmd.commands.find((c) => c.name() === 'collections');
    const listCmd = collectionsCmd!.commands.find((c) => c.name() === 'list');
    const optionNames = listCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--type');
    expect(optionNames).toContain('--cluster-id');
    expect(optionNames).toContain('--since');
    expect(optionNames).toContain('--until');
    expect(optionNames).toContain('--limit');
    expect(optionNames).toContain('--offset');
    expect(optionNames).toContain('--format');
  });
});

describe('listCollections / getCollection', () => {
  let stdout = '';
  let stderr = '';

  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
    process.env.DB_PATH = testDbDir;
  });

  afterAll(() => {
    DatabaseManager.reset();
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    delete process.env.DB_PATH;
  });

  beforeEach(() => {
    DatabaseManager.reset();
    const dbFile = path.join(testDbDir, 'kube9.db');
    if (existsSync(dbFile)) {
      unlinkSync(dbFile);
    }
    const schema = new SchemaManager();
    schema.initialize();
    stdout = '';
    stderr = '';
    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      stdout += msg;
    });
    vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      stderr += msg;
    });
  });

  afterEach(() => {
    DatabaseManager.reset();
    vi.restoreAllMocks();
  });

  it('accepts performance-metrics and security-posture --type filters', async () => {
    const exitSpy = mockExit();
    const perfId = 'coll_perf123456789012345678901234';
    const secId = 'coll_sec1234567890123456789012345';
    const repo = new CollectionRepository();
    repo.insertCollection(performancePayload(perfId));
    repo.insertCollection(securityPosturePayload(secId));

    await listCollections({ type: 'performance-metrics', format: 'json' });
    expect(stdout).toContain(perfId);
    expect(stdout).not.toContain(secId);
    const perfResult = JSON.parse(stdout);
    expect(perfResult.collections).toHaveLength(1);
    expect(perfResult.collections[0].type).toBe('performance-metrics');
    expect(perfResult.pagination.total).toBe(1);

    stdout = '';
    await listCollections({ type: 'security-posture', format: 'json' });
    expect(stdout).toContain(secId);
    const secResult = JSON.parse(stdout);
    expect(secResult.collections[0].type).toBe('security-posture');

    exitSpy.mockRestore();
  });

  it('returns empty success envelope for new types with zero rows', async () => {
    const exitSpy = mockExit();

    await listCollections({ type: 'performance-metrics', format: 'json' });
    const json = JSON.parse(stdout);
    expect(json.collections).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.returned).toBe(0);

    stdout = '';
    await listCollections({ type: 'security-posture', format: 'compact' });
    expect(stdout).toBe('No results found');

    exitSpy.mockRestore();
  });

  it('rejects unknown --type with JSON-on-stderr and non-zero exit', async () => {
    const exitSpy = mockExit();

    await expect(listCollections({ type: 'foo', format: 'json' })).rejects.toThrow(
      'process.exit:1'
    );
    expect(stderr).toContain('"error"');
    const err = JSON.parse(stderr);
    expect(err.error).toBe('Failed to list collections');

    exitSpy.mockRestore();
  });

  it('list/get round-trip returns full CollectionPayload envelope', async () => {
    const exitSpy = mockExit();
    const perfId = 'coll_perf123456789012345678901234';
    const repo = new CollectionRepository();
    repo.insertCollection(performancePayload(perfId));

    stdout = '';
    await getCollection(perfId, { format: 'json' });
    const payload = JSON.parse(stdout);
    expect(payload.version).toBe('v1.0.0');
    expect(payload.type).toBe('performance-metrics');
    expect(payload.data.collectionId).toBe(perfId);
    expect(payload.sanitization.rulesApplied).toContain('hash-identifiers');
    expect(payload).not.toHaveProperty('retention');
    expect(payload).not.toHaveProperty('ttl');

    exitSpy.mockRestore();
  });

  it('list json output has no retention or TTL metadata fields', async () => {
    const exitSpy = mockExit();
    const secId = 'coll_sec1234567890123456789012345';
    const repo = new CollectionRepository();
    repo.insertCollection(securityPosturePayload(secId));

    await listCollections({ type: 'security-posture', format: 'json' });
    const result = JSON.parse(stdout);
    expect(result).not.toHaveProperty('retention');
    expect(result).not.toHaveProperty('ttl');
    expect(result.collections[0]).not.toHaveProperty('retention_window');

    exitSpy.mockRestore();
  });

  it('list table format uses standard columns for new types', async () => {
    const exitSpy = mockExit();
    const perfId = 'coll_perf123456789012345678901234';
    const repo = new CollectionRepository();
    repo.insertCollection(performancePayload(perfId));

    await listCollections({ type: 'performance-metrics', format: 'table' });
    expect(stdout).toContain('COLLECTION_ID');
    expect(stdout).toContain('CLUSTER_ID');
    expect(stdout).toContain('TYPE');
    expect(stdout).toContain('COLLECTED_AT');
    expect(stdout).toContain('performance-metrics');

    exitSpy.mockRestore();
  });
});
