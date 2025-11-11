import { test } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'crypto';
import * as k8s from '@kubernetes/client-node';
import { generateClusterIdentifier } from './identifier.js';
import { kubernetesClient } from '../kubernetes/client.js';

// Mock the kubernetesClient for testing
const originalGetKubeConfig = kubernetesClient.getKubeConfig.bind(kubernetesClient);

test('generateClusterIdentifier - deterministic output', () => {
  // Create a mock KubeConfig with a cluster
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
  
  // Mock getKubeConfig to return our mock
  (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
  
  // Generate identifier twice
  const id1 = generateClusterIdentifier();
  const id2 = generateClusterIdentifier();
  
  // Should be identical
  assert.strictEqual(id1, id2, 'Identifier should be deterministic');
  
  // Restore original
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

test('generateClusterIdentifier - format validation', () => {
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
  assert.ok(identifier.startsWith('sha256:'), 'Identifier should start with sha256:');
  
  // Should be exactly 71 characters (sha256: + 64 hex chars)
  assert.strictEqual(identifier.length, 71, 'Identifier should be 71 characters');
  
  // Should have 64 hex characters after sha256:
  const hashPart = identifier.substring(7);
  assert.ok(/^[0-9a-f]{64}$/.test(hashPart), 'Hash part should be 64 hexadecimal characters');
  
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

test('generateClusterIdentifier - uses CA certificate when available', () => {
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
  
  // Should use CA data, not server URL
  const expectedHash = createHash('sha256')
    .update(caData)
    .digest('hex');
  const expectedIdentifier = `sha256:${expectedHash}`;
  
  assert.strictEqual(identifier, expectedIdentifier, 'Should use CA certificate for hash');
  
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

test('generateClusterIdentifier - falls back to server URL when CA not available', () => {
  const mockKubeConfig = new k8s.KubeConfig();
  const serverUrl = 'https://test.example.com:6443';
  const mockCluster: k8s.Cluster = {
    name: 'test-cluster',
    server: serverUrl,
    // No caData
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
  
  // Should use server URL
  const expectedHash = createHash('sha256')
    .update(serverUrl)
    .digest('hex');
  const expectedIdentifier = `sha256:${expectedHash}`;
  
  assert.strictEqual(identifier, expectedIdentifier, 'Should fall back to server URL when CA not available');
  
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

test('generateClusterIdentifier - non-reversible (cannot extract original data)', () => {
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
  
  // Verify the identifier does not contain the original CA data
  assert.ok(!identifier.includes(caData), 'Identifier should not contain original CA data');
  
  // Verify the identifier does not contain the server URL
  assert.ok(!identifier.includes('test.example.com'), 'Identifier should not contain server URL');
  
  // The hash part should be different from the original data
  const hashPart = identifier.substring(7);
  assert.notStrictEqual(hashPart, caData, 'Hash should be different from original CA data');
  
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

test('generateClusterIdentifier - throws error when no cluster found', () => {
  const mockKubeConfig = new k8s.KubeConfig();
  // No clusters set
  
  (kubernetesClient as any).getKubeConfig = () => mockKubeConfig;
  
  assert.throws(
    () => generateClusterIdentifier(),
    /No current cluster found/,
    'Should throw error when no cluster found'
  );
  
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

test('generateClusterIdentifier - throws error when cluster has neither CA nor server', () => {
  const mockKubeConfig = new k8s.KubeConfig();
  const mockCluster: k8s.Cluster = {
    name: 'test-cluster',
    // No caData and no server
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
  
  assert.throws(
    () => generateClusterIdentifier(),
    /Cluster has neither caData nor server URL/,
    'Should throw error when cluster has neither CA nor server'
  );
  
  (kubernetesClient as any).getKubeConfig = originalGetKubeConfig;
});

