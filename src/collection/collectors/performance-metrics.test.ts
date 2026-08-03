import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('../../cluster/identifier.js', () => ({
  generateClusterIdForCollection: vi.fn(() => 'cls_' + 'a'.repeat(32)),
}));

import { PerformanceMetricsCollector } from './performance-metrics.js';
import type { CollectionRepository } from '../../database/collection-repository.js';
import type { PerformanceMetrics } from '../types.js';

function promSuccessBody(value: string): string {
  return JSON.stringify({
    status: 'success',
    data: {
      resultType: 'vector',
      result: [{ metric: {}, value: [1_700_000_000, value] }],
    },
  });
}

function mockCollectionRepository(
  insertCollection: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(true)
): CollectionRepository {
  return { insertCollection } as unknown as CollectionRepository;
}

describe('PerformanceMetricsCollector', () => {
  let server: Server | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    }
  });

  async function startPrometheusMock(
    handler: (query: string) => { status: number; body: string }
  ): Promise<string> {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const query = url.searchParams.get('query') ?? '';
      const { status, body } = handler(query);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body);
    });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    return `http://127.0.0.1:${port}`;
  }

  it('collect() rejects when Prometheus returns no usable scalars', async () => {
    const baseUrl = await startPrometheusMock(() => ({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: { resultType: 'vector', result: [] },
      }),
    }));

    const collector = new PerformanceMetricsCollector(
      { baseUrl, timeoutMs: 5000, tlsInsecure: false },
      mockCollectionRepository()
    );

    await expect(collector.collect()).rejects.toThrow(/no usable scalar aggregates/i);
  });

  it('collect() returns metrics with source.available true on PromQL success', async () => {
    const baseUrl = await startPrometheusMock((query) => {
      if (query.includes('node_cpu_seconds_total')) {
        return { status: 200, body: promSuccessBody('0.4') };
      }
      return {
        status: 200,
        body: JSON.stringify({
          status: 'success',
          data: { resultType: 'vector', result: [] },
        }),
      };
    });

    const collector = new PerformanceMetricsCollector(
      { baseUrl, timeoutMs: 5000, tlsInsecure: false },
      mockCollectionRepository()
    );

    const metrics = await collector.collect();
    expect(metrics.source.available).toBe(true);
    expect(metrics.utilization?.cpu?.clusterAvgRatio).toBe(0.4);
    expect(metrics.collectionId).toMatch(/^coll_[a-f0-9]{32}$/);
  });

  it('processCollection() persists a validated performance-metrics payload', async () => {
    const insertCollection = vi.fn().mockReturnValue(true);
    const collector = new PerformanceMetricsCollector(
      { baseUrl: 'http://unused.example:9090', timeoutMs: 5000, tlsInsecure: false },
      mockCollectionRepository(insertCollection)
    );

    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'b'.repeat(32),
      clusterId: 'cls_' + 'c'.repeat(32),
      source: { available: true },
      utilization: {
        cpu: { clusterAvgRatio: 0.5 },
        memory: { clusterAvgRatio: 0.6 },
      },
    };

    await collector.processCollection(metrics);

    expect(insertCollection).toHaveBeenCalledTimes(1);
    const payload = insertCollection.mock.calls[0][0] as { type: string; data: PerformanceMetrics };
    expect(payload.type).toBe('performance-metrics');
    expect(payload.data.source.available).toBe(true);
  });

  it('processCollection() throws when durable insert fails', async () => {
    const insertCollection = vi.fn().mockReturnValue(false);
    const collector = new PerformanceMetricsCollector(
      { baseUrl: 'http://unused.example:9090', timeoutMs: 5000, tlsInsecure: false },
      mockCollectionRepository(insertCollection)
    );

    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      collectionId: 'coll_' + 'd'.repeat(32),
      clusterId: 'cls_' + 'e'.repeat(32),
      source: { available: true },
      ratios: { pending_pods_ratio: 0.1 },
    };

    await expect(collector.processCollection(metrics)).rejects.toThrow(/Failed to persist performance metrics/i);
  });
});
