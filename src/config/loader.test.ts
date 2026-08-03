import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './loader.js';

const trackedKeys = [
  'SERVER_URL',
  'RESOURCE_INVENTORY_INTERVAL_SECONDS',
  'ASSESSMENT_ENABLED',
  'ASSESSMENT_INTERVAL_SECONDS',
  'ASSESSMENT_MODE',
  'ASSESSMENT_PILLAR',
  'ASSESSMENT_TIMEOUT_SECONDS',
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

describe('loadConfig — assessment schedule', () => {
  beforeEach(() => {
    stashEnv();
    process.env.SERVER_URL = 'https://config-test.example';
    delete process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS;
    delete process.env.ASSESSMENT_ENABLED;
    delete process.env.ASSESSMENT_INTERVAL_SECONDS;
    delete process.env.ASSESSMENT_MODE;
    delete process.env.ASSESSMENT_PILLAR;
    delete process.env.ASSESSMENT_TIMEOUT_SECONDS;
  });

  afterEach(() => {
    restoreEnv();
  });

  it('applies defaults when assessment env vars are omitted', async () => {
    const config = await loadConfig();
    expect(config.assessmentEnabled).toBe(true);
    expect(config.assessmentIntervalSeconds).toBe(86400);
    expect(config.assessmentMode).toBe('full');
    expect(config.assessmentTimeoutSeconds).toBeUndefined();
  });

  it('parses enabled schedule with pillar mode', async () => {
    process.env.ASSESSMENT_ENABLED = 'true';
    process.env.ASSESSMENT_INTERVAL_SECONDS = '7200';
    process.env.ASSESSMENT_MODE = 'pillar';
    process.env.ASSESSMENT_PILLAR = 'security';
    const config = await loadConfig();
    expect(config.assessmentEnabled).toBe(true);
    expect(config.assessmentIntervalSeconds).toBe(7200);
    expect(config.assessmentMode).toBe('pillar');
    expect(config.assessmentPillar).toBe('security');
  });

  it('rejects pillar mode when enabled without ASSESSMENT_PILLAR', async () => {
    process.env.ASSESSMENT_ENABLED = 'true';
    process.env.ASSESSMENT_MODE = 'pillar';
    await expect(loadConfig()).rejects.toThrow(/ASSESSMENT_PILLAR/);
  });

  it('rejects invalid ASSESSMENT_PILLAR', async () => {
    process.env.ASSESSMENT_ENABLED = 'true';
    process.env.ASSESSMENT_MODE = 'pillar';
    process.env.ASSESSMENT_PILLAR = 'not-a-pillar';
    await expect(loadConfig()).rejects.toThrow(/ASSESSMENT_PILLAR/);
  });

  it('rejects interval below minimum', async () => {
    process.env.ASSESSMENT_INTERVAL_SECONDS = '3599';
    await expect(loadConfig()).rejects.toThrow(/ASSESSMENT_INTERVAL_SECONDS/);
  });

  it('rejects non-numeric collection interval env', async () => {
    const prev = process.env.CLUSTER_METADATA_INTERVAL_SECONDS;
    process.env.CLUSTER_METADATA_INTERVAL_SECONDS = 'not-a-number';
    try {
      await expect(loadConfig()).rejects.toThrow(/CLUSTER_METADATA_INTERVAL_SECONDS/);
    } finally {
      if (prev === undefined) {
        delete process.env.CLUSTER_METADATA_INTERVAL_SECONDS;
      } else {
        process.env.CLUSTER_METADATA_INTERVAL_SECONDS = prev;
      }
    }
  });

  it('rejects invalid mode string', async () => {
    process.env.ASSESSMENT_MODE = 'nope';
    await expect(loadConfig()).rejects.toThrow(/ASSESSMENT_MODE/);
  });

  it('allows single-check mode when scheduling is disabled', async () => {
    process.env.ASSESSMENT_ENABLED = 'false';
    process.env.ASSESSMENT_MODE = 'single-check';
    const config = await loadConfig();
    expect(config.assessmentMode).toBe('single-check');
  });

  it('rejects single-check when scheduling is enabled', async () => {
    process.env.ASSESSMENT_ENABLED = '1';
    process.env.ASSESSMENT_MODE = 'single-check';
    await expect(loadConfig()).rejects.toThrow(/single-check/);
  });

  it('parses optional timeout seconds', async () => {
    process.env.ASSESSMENT_TIMEOUT_SECONDS = '120';
    const config = await loadConfig();
    expect(config.assessmentTimeoutSeconds).toBe(120);
  });

  it('rejects timeout out of range', async () => {
    process.env.ASSESSMENT_TIMEOUT_SECONDS = '30';
    await expect(loadConfig()).rejects.toThrow(/ASSESSMENT_TIMEOUT_SECONDS/);
  });

  it('rejects invalid ASSESSMENT_ENABLED', async () => {
    process.env.ASSESSMENT_ENABLED = 'sure';
    await expect(loadConfig()).rejects.toThrow(/ASSESSMENT_ENABLED/);
  });
});

describe('loadConfig — resource inventory interval', () => {
  beforeEach(() => {
    stashEnv();
    delete process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS;
    delete process.env.ASSESSMENT_ENABLED;
    delete process.env.ASSESSMENT_INTERVAL_SECONDS;
    delete process.env.ASSESSMENT_MODE;
    delete process.env.ASSESSMENT_PILLAR;
    delete process.env.ASSESSMENT_TIMEOUT_SECONDS;
  });

  afterEach(() => {
    restoreEnv();
  });

  it('defaults to 21600 seconds (6 hours)', async () => {
    const config = await loadConfig();
    expect(config.resourceInventoryIntervalSeconds).toBe(21600);
  });

  it('accepts the minimum interval (1800 seconds)', async () => {
    process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS = '1800';
    const config = await loadConfig();
    expect(config.resourceInventoryIntervalSeconds).toBe(1800);
  });

  it('rejects values below the minimum', async () => {
    process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS = '1799';
    await expect(loadConfig()).rejects.toThrow(/RESOURCE_INVENTORY_INTERVAL_SECONDS/);
  });

  it('rejects non-numeric values', async () => {
    process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS = 'not-a-number';
    await expect(loadConfig()).rejects.toThrow(/RESOURCE_INVENTORY_INTERVAL_SECONDS/);
  });
});

describe('loadConfig — performance metrics / Prometheus', () => {
  const promKeys = [
    'PROMETHEUS_BASE_URL',
    'PROMETHEUS_TIMEOUT_MS',
    'PROMETHEUS_TLS_INSECURE',
    'PERFORMANCE_METRICS_INTERVAL_SECONDS',
  ] as const;
  const promSnapshots: Partial<Record<(typeof promKeys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of promKeys) {
      promSnapshots[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of promKeys) {
      const v = promSnapshots[key];
      if (v === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = v;
      }
    }
  });

  it('defaults performance interval to 900 seconds without Prometheus URL', async () => {
    const config = await loadConfig();
    expect(config.performanceMetricsIntervalSeconds).toBe(900);
    expect(config.prometheus).toBeUndefined();
  });

  it('includes prometheus config when PROMETHEUS_BASE_URL is set', async () => {
    process.env.PROMETHEUS_BASE_URL = 'http://prometheus.monitoring.svc:9090';
    process.env.PROMETHEUS_TIMEOUT_MS = '45000';
    const config = await loadConfig();
    expect(config.prometheus).toEqual({
      baseUrl: 'http://prometheus.monitoring.svc:9090',
      timeoutMs: 45000,
      tlsInsecure: false,
    });
  });

  it('rejects performance interval below minimum', async () => {
    process.env.PERFORMANCE_METRICS_INTERVAL_SECONDS = '299';
    await expect(loadConfig()).rejects.toThrow(/PERFORMANCE_METRICS_INTERVAL_SECONDS/);
  });

  it('rejects invalid Prometheus URL during config load', async () => {
    process.env.PROMETHEUS_BASE_URL = ':::bad:::';
    await expect(loadConfig()).rejects.toThrow(/PROMETHEUS_BASE_URL/);
  });

  it('rejects invalid Prometheus timeout during config load', async () => {
    process.env.PROMETHEUS_BASE_URL = 'http://prom.example:9090';
    process.env.PROMETHEUS_TIMEOUT_MS = '999';
    await expect(loadConfig()).rejects.toThrow(/PROMETHEUS_TIMEOUT_MS/);
  });
});

describe('loadConfig — security posture interval', () => {
  const keys = ['SECURITY_POSTURE_INTERVAL_SECONDS'] as const;
  const snapshots: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of keys) {
      snapshots[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const v = snapshots[key];
      if (v === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = v;
      }
    }
  });

  it('defaults security posture interval to 86400 seconds', async () => {
    const config = await loadConfig();
    expect(config.securityPostureIntervalSeconds).toBe(86400);
  });

  it('accepts SECURITY_POSTURE_INTERVAL_SECONDS at minimum 3600', async () => {
    process.env.SECURITY_POSTURE_INTERVAL_SECONDS = '3600';
    const config = await loadConfig();
    expect(config.securityPostureIntervalSeconds).toBe(3600);
  });

  it('rejects security posture interval below minimum', async () => {
    process.env.SECURITY_POSTURE_INTERVAL_SECONDS = '3599';
    await expect(loadConfig()).rejects.toThrow(/SECURITY_POSTURE_INTERVAL_SECONDS/);
  });
});
