import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrometheusClient, PERFORMANCE_PROMQL } from './client.js';

function promSuccessBody(value: string): string {
  return JSON.stringify({
    status: 'success',
    data: {
      resultType: 'vector',
      result: [{ metric: {}, value: [1_700_000_000, value] }],
    },
  });
}

describe('PrometheusClient', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    }
  });

  async function startMock(
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

  it('instantQueryScalar returns a ratio for success responses', async () => {
    const baseUrl = await startMock((query) => {
      if (query === 'up') {
        return { status: 200, body: promSuccessBody('0.42') };
      }
      return { status: 200, body: promSuccessBody('0') };
    });

    const client = new PrometheusClient({ baseUrl, timeoutMs: 5000, tlsInsecure: false });
    const value = await client.instantQueryScalar('up');
    expect(value).toBe(0.42);
  });

  it('instantQueryScalar returns null for empty vector results', async () => {
    const baseUrl = await startMock(() => ({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: { resultType: 'vector', result: [] },
      }),
    }));

    const client = new PrometheusClient({ baseUrl, timeoutMs: 5000, tlsInsecure: false });
    expect(await client.instantQueryScalar('up')).toBeNull();
  });

  it('instantQueryScalar returns null for non-2xx HTTP status', async () => {
    const baseUrl = await startMock(() => ({
      status: 503,
      body: JSON.stringify({ status: 'error', error: 'unavailable' }),
    }));

    const client = new PrometheusClient({ baseUrl, timeoutMs: 5000, tlsInsecure: false });
    expect(await client.instantQueryScalar('up')).toBeNull();
  });

  it('instantQueryScalar returns null for ratios outside [0, 1]', async () => {
    const baseUrl = await startMock(() => ({
      status: 200,
      body: promSuccessBody('1.5'),
    }));

    const client = new PrometheusClient({ baseUrl, timeoutMs: 5000, tlsInsecure: false });
    expect(await client.instantQueryScalar('up')).toBeNull();
  });

  it('queryPerformanceScalars collects usable keys only', async () => {
    const baseUrl = await startMock((query) => {
      if (query === PERFORMANCE_PROMQL.cpuClusterAvg) {
        return { status: 200, body: promSuccessBody('0.25') };
      }
      return {
        status: 200,
        body: JSON.stringify({
          status: 'success',
          data: { resultType: 'vector', result: [] },
        }),
      };
    });

    const client = new PrometheusClient({ baseUrl, timeoutMs: 5000, tlsInsecure: false });
    const scalars = await client.queryPerformanceScalars();
    expect(scalars.cpuClusterAvg).toBe(0.25);
    expect(scalars.memoryClusterAvg).toBeUndefined();
  });
});
