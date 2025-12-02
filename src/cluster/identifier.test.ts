import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import * as k8s from '@kubernetes/client-node';
import { generateClusterIdentifier } from './identifier.js';
import { kubernetesClient } from '../kubernetes/client.js';

describe('generateClusterIdentifier', () => {
  let originalGetKubeConfig: any;

  beforeEach(() => {
    originalGetKubeConfig = kubernetesClient.getKubeConfig.bind(kubernetesClient);
  });

  afterEach(() => {
    (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
  });

  it('deterministic output', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    const mockCluster: k8s.Cluster = {
      name: 'test-cluster',
      server: 'https://test.example.com:6443',
      caData: 'LS0tLS1CRUdJTi...', // Mock base64 CA data
    };
    const mockUser: k8s.User = {
      name: 'test-user',
    };
    const mockContext: k8s.Context = {
      name: 'test-context',
      cluster: 'test-cluster',
      user: 'test-user',
    };
    mockKubeConfig.clusters = [mockCluster];
    mockKubeConfig.users = [mockUser];
    mockKubeConfig.contexts = [mockContext];
    mockKubeConfig.setCurrentContext('test-context');
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    const id1 = generateClusterIdentifier();
    const id2 = generateClusterIdentifier();
    
    expect(id1).toBe(id2);
  });

  it('format validation', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    const mockCluster: k8s.Cluster = {
      name: 'test-cluster',
      server: 'https://test.example.com:6443',
      caData: 'LS0tLS1CRUdJTi...',
    };
    const mockUser: k8s.User = {
      name: 'test-user',
    };
    const mockContext: k8s.Context = {
      name: 'test-context',
      cluster: 'test-cluster',
      user: 'test-user',
    };
    mockKubeConfig.clusters = [mockCluster];
    mockKubeConfig.users = [mockUser];
    mockKubeConfig.contexts = [mockContext];
    mockKubeConfig.setCurrentContext('test-context');
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    const identifier = generateClusterIdentifier();
    
    // Should start with sha256:
    expect(identifier.startsWith('sha256:')).toBe(true);
    // Should be exactly 71 characters (sha256: + 64 hex chars)
    expect(identifier.length).toBe(71);
    
    // Should have 64 hex characters after sha256:
    const hashPart = identifier.substring(7);
    expect(/^[0-9a-f]{64}$/.test(hashPart)).toBe(true);
  });

  it('uses CA certificate when available', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    const caData = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t';
    const mockCluster: k8s.Cluster = {
      name: 'test-cluster',
      server: 'https://test.example.com:6443',
      caData: caData,
    };
    const mockUser: k8s.User = {
      name: 'test-user',
    };
    const mockContext: k8s.Context = {
      name: 'test-context',
      cluster: 'test-cluster',
      user: 'test-user',
    };
    mockKubeConfig.clusters = [mockCluster];
    mockKubeConfig.users = [mockUser];
    mockKubeConfig.contexts = [mockContext];
    mockKubeConfig.setCurrentContext('test-context');
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    const identifier = generateClusterIdentifier();
    
    const expectedHash = createHash('sha256')
      .update(caData)
      .digest('hex');
    const expectedIdentifier = `sha256:${expectedHash}`;
    
    expect(identifier).toBe(expectedIdentifier);
  });

  it('falls back to server URL when CA not available', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    const serverUrl = 'https://test.example.com:6443';
    const mockCluster: k8s.Cluster = {
      name: 'test-cluster',
      server: serverUrl,
    };
    const mockUser: k8s.User = {
      name: 'test-user',
    };
    const mockContext: k8s.Context = {
      name: 'test-context',
      cluster: 'test-cluster',
      user: 'test-user',
    };
    mockKubeConfig.clusters = [mockCluster];
    mockKubeConfig.users = [mockUser];
    mockKubeConfig.contexts = [mockContext];
    mockKubeConfig.setCurrentContext('test-context');
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    const identifier = generateClusterIdentifier();
    
    const expectedHash = createHash('sha256')
      .update(serverUrl)
      .digest('hex');
    const expectedIdentifier = `sha256:${expectedHash}`;
    
    expect(identifier).toBe(expectedIdentifier);
  });

  it('non-reversible (cannot extract original data)', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    const caData = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t';
    const mockCluster: k8s.Cluster = {
      name: 'test-cluster',
      server: 'https://test.example.com:6443',
      caData: caData,
    };
    const mockUser: k8s.User = {
      name: 'test-user',
    };
    const mockContext: k8s.Context = {
      name: 'test-context',
      cluster: 'test-cluster',
      user: 'test-user',
    };
    mockKubeConfig.clusters = [mockCluster];
    mockKubeConfig.users = [mockUser];
    mockKubeConfig.contexts = [mockContext];
    mockKubeConfig.setCurrentContext('test-context');
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    const identifier = generateClusterIdentifier();
    
    expect(identifier.includes(caData)).toBe(false);
    expect(identifier.includes('test.example.com')).toBe(false);
    
    const hashPart = identifier.substring(4);
    expect(hashPart).not.toBe(caData);
  });

  it('throws error when no cluster found', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    expect(() => generateClusterIdentifier()).toThrow(/No current cluster found/);
  });

  it('throws error when cluster has neither CA nor server', () => {
    const mockKubeConfig = new k8s.KubeConfig();
    const mockCluster = {
      name: 'test-cluster',
    } as k8s.Cluster;
    const mockUser: k8s.User = {
      name: 'test-user',
    };
    const mockContext: k8s.Context = {
      name: 'test-context',
      cluster: 'test-cluster',
      user: 'test-user',
    };
    mockKubeConfig.clusters = [mockCluster];
    mockKubeConfig.users = [mockUser];
    mockKubeConfig.contexts = [mockContext];
    mockKubeConfig.setCurrentContext('test-context');
    
    (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
    
    expect(() => generateClusterIdentifier()).toThrow(/Cluster has neither caData nor server URL/);
  });
});
