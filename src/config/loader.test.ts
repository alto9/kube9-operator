import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './loader.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SERVER_URL = 'https://api.kube9.dev';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads default prometheus port and path when not overridden', async () => {
    delete process.env.PROMETHEUS_PORT;
    delete process.env.PROMETHEUS_METRICS_PATH;

    const config = await loadConfig();

    expect(config.prometheus).toEqual({
      port: 8080,
      metricsPath: '/metrics',
    });
  });

  it('loads PROMETHEUS_PORT override from environment', async () => {
    process.env.PROMETHEUS_PORT = '9090';

    const config = await loadConfig();

    expect(config.prometheus.port).toBe(9090);
    expect(config.prometheus.metricsPath).toBe('/metrics');
  });

  it('loads PROMETHEUS_METRICS_PATH override from environment', async () => {
    process.env.PROMETHEUS_METRICS_PATH = '/custom-metrics';

    const config = await loadConfig();

    expect(config.prometheus.port).toBe(8080);
    expect(config.prometheus.metricsPath).toBe('/custom-metrics');
  });

  it('loads both PROMETHEUS_PORT and PROMETHEUS_METRICS_PATH overrides', async () => {
    process.env.PROMETHEUS_PORT = '9090';
    process.env.PROMETHEUS_METRICS_PATH = '/custom-metrics';

    const config = await loadConfig();

    expect(config.prometheus).toEqual({
      port: 9090,
      metricsPath: '/custom-metrics',
    });
  });
});
