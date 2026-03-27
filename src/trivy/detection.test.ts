import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectTrivy, probeTrivyHealth, type TrivyDetectionConfig } from './detection.js';

const baseConfig = (): TrivyDetectionConfig => ({
  autoDetect: true,
  healthPath: '/healthz',
  detectionInterval: 6,
  detectionTimeoutMs: 5000,
  serverUrl: 'http://127.0.0.1:4954',
});

describe('probeTrivyHealth', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns true when health endpoint responds OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const ok = await probeTrivyHealth('http://127.0.0.1:4954', '/healthz', 5000);
    expect(ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('returns false on non-OK HTTP status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const ok = await probeTrivyHealth('http://127.0.0.1:4954', '/healthz', 5000);
    expect(ok).toBe(false);
  });
});

describe('detectTrivy', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reports not detected when autoDetect is false', async () => {
    const status = await detectTrivy({
      ...baseConfig(),
      autoDetect: false,
    });
    expect(status.detected).toBe(false);
    expect(status.serverUrl).toBeNull();
  });

  it('reports not detected when server URL is missing', async () => {
    const status = await detectTrivy({
      ...baseConfig(),
      serverUrl: undefined,
    });
    expect(status.detected).toBe(false);
  });

  it('reports detected when health probe succeeds', async () => {
    globalThis.fetch = vi
      .fn()
      // health
      .mockResolvedValueOnce({ ok: true, status: 200 })
      // /version optional
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const status = await detectTrivy(baseConfig());
    expect(status.detected).toBe(true);
    expect(status.serverUrl).toBe('http://127.0.0.1:4954');
  });

  it('parses JSON version from /version when available', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Version: '0.58.0' }),
      });

    const status = await detectTrivy(baseConfig());
    expect(status.detected).toBe(true);
    expect(status.version).toBe('0.58.0');
  });
});
