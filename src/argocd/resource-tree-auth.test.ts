import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveDedicatedArgoCdApiToken } from './resource-tree-auth.js';
import type { ArgoCdApiCollectionEnvConfig } from './application-status-env.js';

describe('resource-tree-auth', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kube9-rt-auth-'));
    delete process.env.ARGOCD_API_BEARER_TOKEN;
  });

  afterEach(() => {
    delete process.env.ARGOCD_API_BEARER_TOKEN;
  });

  const baseConfig = (): ArgoCdApiCollectionEnvConfig => ({
    collectionEnabled: true,
    baseUrl: '',
    timeoutMs: 30000,
    tlsInsecure: false,
    serverServiceName: 'argocd-server',
  });

  it('prefers ARGOCD_API_BEARER_TOKEN', () => {
    process.env.ARGOCD_API_BEARER_TOKEN = ' inline-token ';
    expect(resolveDedicatedArgoCdApiToken(baseConfig())).toBe('inline-token');
  });

  it('reads ARGOCD_API_TOKEN_FILE when bearer env is unset', () => {
    const tokenPath = join(tempDir, 'token');
    writeFileSync(tokenPath, 'file-token\n');
    expect(
      resolveDedicatedArgoCdApiToken({ ...baseConfig(), tokenFile: tokenPath })
    ).toBe('file-token');
  });

  it('does not fall back to service account token', () => {
    const saPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    if (existsSync(saPath)) {
      expect(resolveDedicatedArgoCdApiToken(baseConfig())).toBeNull();
    } else {
      expect(resolveDedicatedArgoCdApiToken(baseConfig())).toBeNull();
    }
  });

  it('returns null when neither bearer nor token file is configured', () => {
    expect(resolveDedicatedArgoCdApiToken(baseConfig())).toBeNull();
  });
});
