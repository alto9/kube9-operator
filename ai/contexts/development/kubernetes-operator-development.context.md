---
context_id: kubernetes-operator-development
category: development
---

# Kubernetes Operator Development Context

## Overview

This context provides guidance for developing Kubernetes operators, specifically for the kube9-operator which is built using Node.js 22.

## When to Use This Context

```gherkin
Scenario: Building a Kubernetes operator in Node.js
  Given you are developing the kube9-operator
  When you need to interact with the Kubernetes API
  Then use the @kubernetes/client-node library
  And follow Kubernetes operator patterns
  And implement proper RBAC permissions
```

## Kubernetes Client Library

### Installation

```bash
npm install @kubernetes/client-node
```

### Basic Usage

```typescript
import * as k8s from '@kubernetes/client-node';

// Load kubeconfig (in-cluster or from file)
const kc = new k8s.KubeConfig();

// In-cluster config (when running as pod)
kc.loadFromCluster();

// Or from file (for local development)
// kc.loadFromFile('/path/to/kubeconfig');

// Create API clients
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
```

## Common Operator Patterns

### Creating or Updating ConfigMap

```typescript
async function createOrUpdateConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>
): Promise<void> {
  const configMap: k8s.V1ConfigMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': 'kube9-operator',
        'app.kubernetes.io/component': 'status'
      }
    },
    data
  };

  try {
    // Try to read existing ConfigMap
    await coreApi.readNamespacedConfigMap(name, namespace);
    
    // ConfigMap exists, update it
    await coreApi.replaceNamespacedConfigMap(name, namespace, configMap);
    
  } catch (error) {
    if (error.statusCode === 404) {
      // ConfigMap doesn't exist, create it
      await coreApi.createNamespacedConfigMap(namespace, configMap);
    } else {
      throw error;
    }
  }
}
```

### Reading Cluster Information

```typescript
async function getClusterInfo(): Promise<{
  version: string;
  nodeCount: number;
}> {
  // Get Kubernetes version
  const versionApi = kc.makeApiClient(k8s.VersionApi);
  const versionInfo = await versionApi.getCode();
  
  // Get node count
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  const nodeList = await coreApi.listNode();
  
  return {
    version: versionInfo.gitVersion,
    nodeCount: nodeList.items.length
  };
}
```

### Generating Cluster Identifier

```typescript
import { createHash } from 'crypto';

async function generateClusterIdentifier(): Promise<string> {
  const cluster = kc.getCurrentCluster();
  
  // Use cluster CA certificate if available
  if (cluster.caData) {
    const hash = createHash('sha256')
      .update(cluster.caData)
      .digest('hex');
    return `sha256:${hash}`;
  }
  
  // Fallback to server URL
  const hash = createHash('sha256')
    .update(cluster.server)
    .digest('hex');
  return `sha256:${hash}`;
}
```

## RBAC Permissions

### Required Permissions

The operator needs these RBAC permissions:

```yaml
# ClusterRole for reading cluster metadata
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube9-operator
rules:
# Read cluster metadata
- apiGroups: [""]
  resources: ["nodes", "namespaces"]
  verbs: ["get", "list", "watch"]

---
# Role for managing status ConfigMap
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-operator
  namespace: kube9-system
rules:
# Manage status ConfigMap
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "create", "update", "patch"]
```

## Health Checks

### Implementing Health Endpoints

```typescript
import express from 'express';

const app = express();
const port = 8080;

// Liveness probe - operator is running
app.get('/healthz', (req, res) => {
  // Check if operator can perform basic operations
  if (canAccessKubernetesAPI) {
    res.status(200).send('OK');
  } else {
    res.status(500).send('Not healthy');
  }
});

// Readiness probe - operator is ready to serve
app.get('/readyz', (req, res) => {
  // Check if operator has completed initialization
  if (isInitialized && canWriteConfigMap) {
    res.status(200).send('Ready');
  } else {
    res.status(503).send('Not ready');
  }
});

app.listen(port, () => {
  console.log(`Health server listening on port ${port}`);
});
```

## Error Handling

### Handling Kubernetes API Errors

```typescript
try {
  await coreApi.createNamespacedConfigMap(namespace, configMap);
} catch (error) {
  if (error.statusCode === 409) {
    // Conflict - resource already exists
    console.log('ConfigMap already exists, updating...');
    await coreApi.replaceNamespacedConfigMap(name, namespace, configMap);
    
  } else if (error.statusCode === 403) {
    // Forbidden - insufficient permissions
    console.error('Insufficient RBAC permissions');
    throw new Error('Check RBAC configuration');
    
  } else if (error.statusCode === 404) {
    // Not found - namespace or resource doesn't exist
    console.error('Resource not found');
    throw error;
    
  } else {
    // Other error
    console.error('Kubernetes API error:', error.message);
    throw error;
  }
}
```

## Logging Best Practices

### Structured Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Usage
logger.info('Status updated', {
  mode: 'enabled',
  tier: 'pro',
  health: 'healthy'
});

logger.error('Registration failed', {
  error: error.message,
  statusCode: error.statusCode
});
```

### Log Levels

- **debug**: Detailed diagnostic information
- **info**: General informational messages
- **warn**: Warning messages for non-critical issues
- **error**: Error messages for failures

## Security Best Practices

### Reading Secrets

```typescript
async function readAPIKey(): Promise<string | null> {
  try {
    const secret = await coreApi.readNamespacedSecret(
      'kube9-operator-config',
      'kube9-system'
    );
    
    // API key is base64 encoded in Kubernetes Secrets
    const apiKey = Buffer.from(secret.data.apiKey, 'base64').toString();
    
    return apiKey;
    
  } catch (error) {
    if (error.statusCode === 404) {
      // Secret doesn't exist - running in free tier
      return null;
    }
    throw error;
  }
}
```

### Never Log Sensitive Data

```typescript
// BAD - logs API key
logger.info('Registration', { apiKey: config.apiKey });

// GOOD - logs only non-sensitive info
logger.info('Registration', { hasApiKey: !!config.apiKey });
```

## Background Tasks

### Periodic Status Updates

```typescript
class StatusUpdater {
  private intervalHandle: NodeJS.Timeout | null = null;
  
  start(intervalSeconds: number) {
    this.intervalHandle = setInterval(
      () => this.updateStatus(),
      intervalSeconds * 1000
    );
  }
  
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
  
  private async updateStatus() {
    try {
      const status = await this.calculateStatus();
      await this.writeStatusConfigMap(status);
      logger.info('Status updated', { status });
    } catch (error) {
      logger.error('Status update failed', { error: error.message });
    }
  }
}
```

### Graceful Shutdown

```typescript
class Operator {
  async shutdown() {
    logger.info('Shutting down operator');
    
    // Stop background tasks
    this.statusUpdater.stop();
    this.registrationManager.stop();
    
    // Update status to indicate shutdown
    await this.writeStatus({
      ...this.currentStatus,
      health: 'unhealthy',
      error: 'Operator is shutting down'
    });
    
    logger.info('Shutdown complete');
  }
}

// Handle shutdown signals
process.on('SIGTERM', async () => {
  await operator.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await operator.shutdown();
  process.exit(0);
});
```

## Testing

### Unit Tests with Mock Kubernetes API

```typescript
import { jest } from '@jest/globals';

// Mock the Kubernetes client
jest.mock('@kubernetes/client-node');

test('createOrUpdateConfigMap creates new ConfigMap', async () => {
  const mockCreate = jest.fn().mockResolvedValue({});
  const mockRead = jest.fn().mockRejectedValue({ statusCode: 404 });
  
  coreApi.createNamespacedConfigMap = mockCreate;
  coreApi.readNamespacedConfigMap = mockRead;
  
  await createOrUpdateConfigMap('kube9-system', 'test-config', { key: 'value' });
  
  expect(mockRead).toHaveBeenCalled();
  expect(mockCreate).toHaveBeenCalled();
});
```

### Integration Tests with Kind

```bash
# Start Kind cluster for testing
kind create cluster --name kube9-test

# Run integration tests
npm run test:integration

# Clean up
kind delete cluster --name kube9-test
```

## Deployment Considerations

### In-Cluster Configuration

```typescript
// Load config from service account
const kc = new k8s.KubeConfig();
kc.loadFromCluster();
```

### Resource Limits

Set appropriate resource requests and limits in Deployment:

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### Security Context

Run with least privilege:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

## Resources

- **@kubernetes/client-node**: https://github.com/kubernetes-client/javascript
- **Kubernetes API Reference**: https://kubernetes.io/docs/reference/kubernetes-api/
- **Operator Pattern**: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
- **RBAC Authorization**: https://kubernetes.io/docs/reference/access-authn-authz/rbac/

