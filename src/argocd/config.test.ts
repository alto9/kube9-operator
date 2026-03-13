import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseArgoCDConfig } from './config.js';

describe('parseArgoCDConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default config when no ArgoCD env vars are set', () => {
    delete process.env.ARGOCD_AUTO_DETECT;
    delete process.env.ARGOCD_ENABLED;
    delete process.env.ARGOCD_NAMESPACE;
    delete process.env.ARGOCD_SELECTOR;
    delete process.env.ARGOCD_ENDPOINT_OVERRIDE;
    delete process.env.ARGOCD_DETECTION_INTERVAL;

    const config = parseArgoCDConfig();

    expect(config.autoDetect).toBe(true);
    expect(config.enabled).toBeUndefined();
    expect(config.namespace).toBe('argocd');
    expect(config.selector).toBe('app.kubernetes.io/name=argocd-server');
    expect(config.endpointOverride).toBeUndefined();
    expect(config.detectionInterval).toBe(6);
  });

  it('parses ARGOCD_ENDPOINT_OVERRIDE from environment', () => {
    process.env.ARGOCD_ENDPOINT_OVERRIDE =
      'https://argocd-server.argocd.svc.cluster.local';

    const config = parseArgoCDConfig();

    expect(config.endpointOverride).toBe(
      'https://argocd-server.argocd.svc.cluster.local'
    );
  });

  it('parses ARGOCD_ENDPOINT_OVERRIDE with custom namespace URL', () => {
    process.env.ARGOCD_ENDPOINT_OVERRIDE =
      'https://argocd-server.my-ns.svc.cluster.local';

    const config = parseArgoCDConfig();

    expect(config.endpointOverride).toBe(
      'https://argocd-server.my-ns.svc.cluster.local'
    );
  });

  it('parses all ArgoCD env vars including endpoint override', () => {
    process.env.ARGOCD_AUTO_DETECT = 'false';
    process.env.ARGOCD_ENABLED = 'true';
    process.env.ARGOCD_NAMESPACE = 'custom-argocd';
    process.env.ARGOCD_SELECTOR = 'app=argocd';
    process.env.ARGOCD_ENDPOINT_OVERRIDE = 'https://custom-argocd.example.com';
    process.env.ARGOCD_DETECTION_INTERVAL = '12';

    const config = parseArgoCDConfig();

    expect(config.autoDetect).toBe(false);
    expect(config.enabled).toBe(true);
    expect(config.namespace).toBe('custom-argocd');
    expect(config.selector).toBe('app=argocd');
    expect(config.endpointOverride).toBe('https://custom-argocd.example.com');
    expect(config.detectionInterval).toBe(12);
  });

  it('leaves endpointOverride undefined when ARGOCD_ENDPOINT_OVERRIDE is empty', () => {
    process.env.ARGOCD_ENDPOINT_OVERRIDE = '';

    const config = parseArgoCDConfig();

    expect(config.endpointOverride).toBeUndefined();
  });
});
