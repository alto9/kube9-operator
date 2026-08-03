import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parsePrometheusConfigFromEnv } from './env-config.js';

const trackedKeys = [
  'PROMETHEUS_BASE_URL',
  'PROMETHEUS_TIMEOUT_MS',
  'PROMETHEUS_TLS_INSECURE',
] as const;

const snapshots: Partial<Record<(typeof trackedKeys)[number], string | undefined>> = {};

function stashEnv(): void {
  for (const key of trackedKeys) {
    snapshots[key] = process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of trackedKeys) {
    const v = snapshots[key];
    if (v === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = v;
    }
  }
}

describe('parsePrometheusConfigFromEnv', () => {
  beforeEach(() => {
    stashEnv();
    delete process.env.PROMETHEUS_BASE_URL;
    delete process.env.PROMETHEUS_TIMEOUT_MS;
    delete process.env.PROMETHEUS_TLS_INSECURE;
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns undefined when PROMETHEUS_BASE_URL is unset', () => {
    expect(parsePrometheusConfigFromEnv()).toBeUndefined();
  });

  it('returns undefined when PROMETHEUS_BASE_URL is empty', () => {
    process.env.PROMETHEUS_BASE_URL = '   ';
    expect(parsePrometheusConfigFromEnv()).toBeUndefined();
  });

  it('parses a valid http URL with defaults', () => {
    process.env.PROMETHEUS_BASE_URL = 'http://prometheus.monitoring.svc:9090/';
    const cfg = parsePrometheusConfigFromEnv();
    expect(cfg).toEqual({
      baseUrl: 'http://prometheus.monitoring.svc:9090',
      timeoutMs: 30000,
      tlsInsecure: false,
    });
  });

  it('parses timeout and tls flags when set', () => {
    process.env.PROMETHEUS_BASE_URL = 'https://prom.example:9090';
    process.env.PROMETHEUS_TIMEOUT_MS = '5000';
    process.env.PROMETHEUS_TLS_INSECURE = 'true';
    const cfg = parsePrometheusConfigFromEnv();
    expect(cfg?.timeoutMs).toBe(5000);
    expect(cfg?.tlsInsecure).toBe(true);
  });

  it('rejects malformed URL when set', () => {
    process.env.PROMETHEUS_BASE_URL = 'not-a-url';
    expect(() => parsePrometheusConfigFromEnv()).toThrow(/PROMETHEUS_BASE_URL/);
  });

  it('rejects non-http(s) scheme when set', () => {
    process.env.PROMETHEUS_BASE_URL = 'ftp://prom.example:9090';
    expect(() => parsePrometheusConfigFromEnv()).toThrow(/http or https/);
  });

  it('rejects timeout below minimum when URL is set', () => {
    process.env.PROMETHEUS_BASE_URL = 'http://prom.example:9090';
    process.env.PROMETHEUS_TIMEOUT_MS = '500';
    expect(() => parsePrometheusConfigFromEnv()).toThrow(/PROMETHEUS_TIMEOUT_MS/);
  });

  it('rejects invalid TLS boolean when URL is set', () => {
    process.env.PROMETHEUS_BASE_URL = 'http://prom.example:9090';
    process.env.PROMETHEUS_TLS_INSECURE = 'maybe';
    expect(() => parsePrometheusConfigFromEnv()).toThrow(/PROMETHEUS_TLS_INSECURE/);
  });
});
