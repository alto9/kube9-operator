import { test } from 'node:test';
import assert from 'node:assert';
import { RegistrationManager } from './manager.js';
import { RegistrationClient } from './client.js';
import type { Config } from '../config/types.js';
import type { RegistrationRequest, RegistrationResponse } from './types.js';
import {
  UnauthorizedError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from './types.js';
import type { ClusterInfo } from '../kubernetes/client.js';

// Mock implementations
function createMockConfig(apiKey: string | null = 'kdy_prod_test123'): Config {
  return {
    apiKey,
    serverUrl: 'https://api.kube9.dev',
    logLevel: 'info',
    statusUpdateIntervalSeconds: 60,
    reregistrationIntervalHours: 24,
    clusterMetadataIntervalSeconds: 86400,
    resourceInventoryIntervalSeconds: 21600,
    resourceConfigurationPatternsIntervalSeconds: 43200,
  };
}

function createMockClusterInfo(): ClusterInfo {
  return {
    version: '1.28.0',
    nodeCount: 5,
  };
}

function createMockRegistrationResponse(): RegistrationResponse {
  return {
    status: 'registered',
    clusterId: 'cls_test123',
    tier: 'pro',
    configuration: {
      statusUpdateIntervalSeconds: 60,
      reregistrationIntervalHours: 24,
    },
  };
}

// Test helper to create a mock registration client
function createMockRegistrationClient(
  behavior: 'success' | 'unauthorized' | 'rateLimit' | 'serverError' | 'timeout' | 'networkError' = 'success'
): RegistrationClient {
  const client = new RegistrationClient('https://api.kube9.dev', 'test-key');
  
  // Override the register method
  const originalRegister = client.register.bind(client);
  (client as any).register = async (request: RegistrationRequest): Promise<RegistrationResponse> => {
    switch (behavior) {
      case 'success':
        return createMockRegistrationResponse();
      case 'unauthorized':
        throw new UnauthorizedError('Invalid API key');
      case 'rateLimit':
        throw new RateLimitError('Rate limited', 3600);
      case 'serverError':
        throw new ServerError('Server error', 500);
      case 'timeout':
        throw new TimeoutError('Request timed out');
      case 'networkError':
        throw new Error('Network error: Failed to connect');
      default:
        return createMockRegistrationResponse();
    }
  };
  
  return client;
}

test('RegistrationManager - skips registration when no API key', async () => {
  const config = createMockConfig(null);
  const client = createMockRegistrationClient();
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
  assert.strictEqual(state.clusterId, undefined);
  assert.strictEqual(state.consecutiveFailures, 0);

  manager.stop();
});

test('RegistrationManager - successful initial registration', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('success');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait a bit for async registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, true);
  assert.strictEqual(state.clusterId, 'cls_test123');
  assert.strictEqual(state.consecutiveFailures, 0);

  manager.stop();
});

test('RegistrationManager - handles invalid API key (401)', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('unauthorized');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait a bit for async registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
  assert.strictEqual(state.clusterId, undefined);
  // Should not retry on invalid key
  assert.strictEqual(state.consecutiveFailures, 1);

  manager.stop();
});

test('RegistrationManager - handles rate limit (429)', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('rateLimit');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait a bit for async registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
  // Rate limit should schedule retry but not increment failures immediately
  // (retry is scheduled based on Retry-After header)

  manager.stop();
});

test('RegistrationManager - handles server error with retry', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('serverError');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait a bit for async registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
  assert.strictEqual(state.consecutiveFailures, 1);
  // Should schedule retry with backoff

  manager.stop();
});

test('RegistrationManager - handles timeout with retry', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('timeout');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait a bit for async registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
  assert.strictEqual(state.consecutiveFailures, 1);
  // Should schedule retry with backoff

  manager.stop();
});

test('RegistrationManager - getState returns current registration state', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('success');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  // Initial state should be unregistered
  let state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
  assert.strictEqual(state.clusterId, undefined);
  assert.strictEqual(state.consecutiveFailures, 0);

  await manager.start();

  // Wait for registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // State should be updated after successful registration
  state = manager.getState();
  assert.strictEqual(state.isRegistered, true);
  assert.strictEqual(state.clusterId, 'cls_test123');
  assert.strictEqual(state.consecutiveFailures, 0);

  manager.stop();
});

test('RegistrationManager - stop cleans up timers', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('success');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait for registration to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Stop should not throw
  manager.stop();

  // Calling stop again should be safe
  manager.stop();

  // State should still be accessible after stop
  const state = manager.getState();
  assert.ok(state !== null);
});

test('RegistrationManager - does not start if already stopped', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('success');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  manager.stop();

  // Starting after stop should not do anything
  await manager.start();

  const state = manager.getState();
  assert.strictEqual(state.isRegistered, false);
});

test('RegistrationManager - exponential backoff on consecutive failures', async () => {
  const config = createMockConfig();
  const client = createMockRegistrationClient('serverError');
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait for first failure
  await new Promise(resolve => setTimeout(resolve, 100));

  let state = manager.getState();
  assert.strictEqual(state.consecutiveFailures, 1);

  // After max retries, should stop retrying
  // Note: This test verifies the retry logic exists, but doesn't wait for all retries
  // Full retry testing would require mocking timers

  manager.stop();
});

test('RegistrationManager - schedules periodic re-registration', async () => {
  const config = createMockConfig();
  // Use shorter interval for testing
  config.reregistrationIntervalHours = 0.001; // ~3.6 seconds
  
  const client = createMockRegistrationClient('success');
  let callCount = 0;
  
  // Track registration calls
  const originalRegister = client.register.bind(client);
  (client as any).register = async (request: RegistrationRequest) => {
    callCount++;
    return originalRegister(request);
  };
  
  const manager = new RegistrationManager(
    config,
    client,
    () => 'sha256:test123',
    async () => createMockClusterInfo()
  );

  await manager.start();

  // Wait for initial registration
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.strictEqual(callCount, 1);

  // Wait for re-registration (with some buffer)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Should have been called at least twice (initial + re-registration)
  assert.ok(callCount >= 2, `Expected at least 2 calls, got ${callCount}`);

  manager.stop();
});

