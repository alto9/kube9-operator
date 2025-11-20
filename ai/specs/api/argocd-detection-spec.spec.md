---
spec_id: argocd-detection-spec
feature_id: [argocd-awareness]
diagram_id: [argocd-detection-flow]
context_id: [kubernetes-operator-development]
---

# ArgoCD Detection Specification

## Overview

This specification defines how the kube9-operator detects ArgoCD installation, what configuration options are available, and how ArgoCD status is exposed through the OperatorStatus.

## OperatorStatus Extension

### ArgoCD Status Fields

The OperatorStatus is extended with an `argocd` field:

```typescript
interface OperatorStatus {
  // ... existing fields (mode, tier, version, health, etc.)
  
  // ArgoCD awareness information
  argocd: {
    // Whether ArgoCD is detected in the cluster
    detected: boolean;
    
    // Namespace where ArgoCD is installed (null if not detected)
    namespace: string | null;
    
    // ArgoCD version (null if not detected or version unavailable)
    version: string | null;
    
    // ISO 8601 timestamp of last detection check
    lastChecked: string;
  };
}
```

### Example Status - ArgoCD Detected

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-20T15:30:00Z",
  "registered": false,
  "error": null,
  "argocd": {
    "detected": true,
    "namespace": "argocd",
    "version": "v2.8.0",
    "lastChecked": "2025-11-20T15:30:00Z"
  }
}
```

### Example Status - ArgoCD Not Detected

```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-20T15:30:00Z",
  "registered": true,
  "error": null,
  "clusterId": "cls_abc123",
  "argocd": {
    "detected": false,
    "namespace": null,
    "version": null,
    "lastChecked": "2025-11-20T15:30:00Z"
  }
}
```

### Example Status - Custom Namespace

```json
{
  "mode": "operated",
  "tier": "free",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-20T15:30:00Z",
  "registered": false,
  "error": null,
  "argocd": {
    "detected": true,
    "namespace": "gitops",
    "version": "v2.9.3",
    "lastChecked": "2025-11-20T15:30:00Z"
  }
}
```

## Helm Configuration

### values.yaml Schema

```yaml
# ArgoCD integration configuration
argocd:
  # Enable automatic ArgoCD detection (default: true)
  # When true, operator will check for ArgoCD presence at startup and periodically
  autoDetect: true
  
  # Explicitly enable or disable ArgoCD integration (optional)
  # When set, this overrides autoDetect
  # enabled: true
  
  # Custom namespace where ArgoCD is installed (default: "argocd")
  # Only used if autoDetect is true or enabled is true
  # namespace: "argocd"
  
  # Custom label selector for ArgoCD server deployment (optional)
  # Default: "app.kubernetes.io/name=argocd-server"
  # selector: "app.kubernetes.io/name=argocd-server"
  
  # Detection check interval in hours (default: 6)
  # How often to re-check ArgoCD presence
  # detectionInterval: 6
```

### Configuration Examples

**Default Configuration (Auto-detect)**:
```yaml
argocd:
  autoDetect: true
```

**Disable ArgoCD Detection**:
```yaml
argocd:
  autoDetect: false
```

**Explicit Enable with Custom Namespace**:
```yaml
argocd:
  enabled: true
  namespace: "gitops"
```

**Custom Detection Interval**:
```yaml
argocd:
  autoDetect: true
  detectionInterval: 12  # Check every 12 hours
```

## Detection Logic

### Detection Algorithm

The operator follows this detection sequence:

```typescript
interface ArgoCDDetectionConfig {
  autoDetect: boolean;
  enabled?: boolean;
  namespace?: string;
  selector?: string;
  detectionInterval: number;
}

interface ArgoCDStatus {
  detected: boolean;
  namespace: string | null;
  version: string | null;
  lastChecked: string;
}

async function detectArgoCD(
  config: ArgoCDDetectionConfig
): Promise<ArgoCDStatus> {
  const now = new Date().toISOString();
  
  // Check 1: Is detection disabled?
  if (config.enabled === false || config.autoDetect === false) {
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: now
    };
  }
  
  // Check 2: Is ArgoCD explicitly enabled?
  if (config.enabled === true) {
    return await detectInNamespace(config.namespace || "argocd", config.selector, now);
  }
  
  // Check 3: Auto-detect with CRD check
  const hasCRD = await checkForApplicationCRD();
  if (!hasCRD) {
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: now
    };
  }
  
  // Check 4: Verify deployment in namespace
  return await detectInNamespace(config.namespace || "argocd", config.selector, now);
}

async function checkForApplicationCRD(): Promise<boolean> {
  try {
    const crd = await k8sClient.apiextensions.getCustomResourceDefinition(
      "applications.argoproj.io"
    );
    return crd !== null;
  } catch (error) {
    if (error.statusCode === 404) {
      return false;
    }
    // Log error but don't fail
    logger.warn("Error checking for ArgoCD CRD", { error });
    return false;
  }
}

async function detectInNamespace(
  namespace: string,
  selector: string = "app.kubernetes.io/name=argocd-server",
  timestamp: string
): Promise<ArgoCDStatus> {
  try {
    // Check if namespace exists
    const ns = await k8sClient.core.readNamespace(namespace);
    if (!ns) {
      return {
        detected: false,
        namespace: null,
        version: null,
        lastChecked: timestamp
      };
    }
    
    // Check for ArgoCD server deployment
    const deployments = await k8sClient.apps.listNamespacedDeployment(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      selector
    );
    
    if (deployments.items.length === 0) {
      return {
        detected: false,
        namespace: null,
        version: null,
        lastChecked: timestamp
      };
    }
    
    // Extract version from deployment
    const deployment = deployments.items[0];
    const version = extractVersion(deployment);
    
    return {
      detected: true,
      namespace: namespace,
      version: version,
      lastChecked: timestamp
    };
    
  } catch (error) {
    logger.warn("Error detecting ArgoCD in namespace", { namespace, error });
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: timestamp
    };
  }
}

function extractVersion(deployment: V1Deployment): string | null {
  // Try to get version from labels
  const labels = deployment.metadata?.labels || {};
  
  // Check common version label patterns
  const versionLabels = [
    "app.kubernetes.io/version",
    "argocd.argoproj.io/version",
    "version"
  ];
  
  for (const labelKey of versionLabels) {
    if (labels[labelKey]) {
      return labels[labelKey];
    }
  }
  
  // Try to extract from image tag
  const containers = deployment.spec?.template?.spec?.containers || [];
  const argoCDContainer = containers.find(c => 
    c.name === "argocd-server" || c.image?.includes("argocd")
  );
  
  if (argoCDContainer?.image) {
    const imageMatch = argoCDContainer.image.match(/:v?(\d+\.\d+\.\d+)/);
    if (imageMatch) {
      return `v${imageMatch[1]}`;
    }
  }
  
  return null;
}
```

### Configuration Precedence

The detection logic follows this precedence:

1. **`enabled: false`** → Always return detected: false (highest priority)
2. **`autoDetect: false`** → Always return detected: false
3. **`enabled: true`** → Skip CRD check, directly check namespace
4. **Default behavior** → CRD check + namespace verification

### Detection Timing

**On Startup**:
- Detection runs during operator initialization
- Occurs before first status update
- Blocks status update until detection completes (with 30s timeout)

**Periodic Checks**:
- Scheduled based on `detectionInterval` (default: 6 hours)
- Runs in background, doesn't block other operations
- Updates OperatorStatus only if detection result changed

**Timing Calculation**:
```typescript
const detectionIntervalMs = config.detectionInterval * 60 * 60 * 1000; // hours to ms

setInterval(async () => {
  const newStatus = await detectArgoCD(config);
  
  // Only update if status changed
  if (hasStatusChanged(currentStatus, newStatus)) {
    await updateOperatorStatus({ argocd: newStatus });
    logger.info("ArgoCD status changed", { 
      previous: currentStatus.detected,
      current: newStatus.detected 
    });
  }
}, detectionIntervalMs);
```

## RBAC Requirements

### Minimum Permissions for Detection

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube9-operator-argocd-detection
rules:
  # Check for ArgoCD CRD
  - apiGroups: ["apiextensions.k8s.io"]
    resources: ["customresourcedefinitions"]
    verbs: ["get", "list"]
  
  # Check for ArgoCD namespace
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get"]
  
  # Check for ArgoCD server deployment
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
```

### Permission Scoping

For enhanced security, permissions can be scoped to specific resources:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube9-operator-argocd-detection-scoped
rules:
  # Only allow checking for ArgoCD Application CRD
  - apiGroups: ["apiextensions.k8s.io"]
    resources: ["customresourcedefinitions"]
    resourceNames: ["applications.argoproj.io"]
    verbs: ["get"]
  
  # Only allow checking ArgoCD namespace
  - apiGroups: [""]
    resources: ["namespaces"]
    resourceNames: ["argocd"]  # Or custom namespace
    verbs: ["get"]
  
  # Only allow checking deployments in ArgoCD namespace
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
```

## Error Handling

### Permission Errors

```typescript
try {
  const crd = await checkForApplicationCRD();
} catch (error) {
  if (error.statusCode === 403) {
    logger.warn(
      "Insufficient permissions for ArgoCD detection. " +
      "RBAC may need customresourcedefinitions get/list permissions.",
      { error }
    );
    return {
      detected: false,
      namespace: null,
      version: null,
      lastChecked: new Date().toISOString()
    };
  }
  throw error;
}
```

### Timeout Handling

```typescript
async function detectArgoCDWithTimeout(
  config: ArgoCDDetectionConfig,
  timeoutMs: number = 30000
): Promise<ArgoCDStatus> {
  const timeoutPromise = new Promise<ArgoCDStatus>((resolve) => {
    setTimeout(() => {
      logger.warn("ArgoCD detection timed out", { timeoutMs });
      resolve({
        detected: false,
        namespace: null,
        version: null,
        lastChecked: new Date().toISOString()
      });
    }, timeoutMs);
  });
  
  return Promise.race([
    detectArgoCD(config),
    timeoutPromise
  ]);
}
```

### Network Errors

All Kubernetes API errors are handled gracefully:

```typescript
async function handleDetectionError(error: Error): Promise<ArgoCDStatus> {
  logger.warn("ArgoCD detection failed", { 
    error: error.message,
    stack: error.stack 
  });
  
  return {
    detected: false,
    namespace: null,
    version: null,
    lastChecked: new Date().toISOString()
  };
}
```

## Logging

### Log Levels

**INFO** - Normal detection events:
```
[INFO] ArgoCD detection started
[INFO] ArgoCD detected in namespace 'argocd', version 'v2.8.0'
[INFO] ArgoCD not detected in cluster
[INFO] ArgoCD installation detected (previously not detected)
[INFO] ArgoCD uninstallation detected (previously detected)
```

**WARN** - Non-critical issues:
```
[WARN] Insufficient permissions for ArgoCD detection: forbidden
[WARN] Error checking for ArgoCD CRD: connection timeout
[WARN] Multiple ArgoCD installations detected, using namespace 'argocd'
[WARN] ArgoCD detection timed out after 30s
```

**DEBUG** - Detailed detection info:
```
[DEBUG] Checking for Application CRD: applications.argoproj.io
[DEBUG] ArgoCD namespace 'argocd' exists
[DEBUG] Found ArgoCD server deployment with selector 'app.kubernetes.io/name=argocd-server'
[DEBUG] Could not determine ArgoCD version from deployment labels or image
[DEBUG] ArgoCD status unchanged, skipping OperatorStatus update
```

## Testing

### Unit Tests

Test scenarios:
- CRD exists, deployment exists → detected: true
- CRD exists, deployment missing → detected: false
- CRD missing → detected: false
- Custom namespace with deployment → detected: true
- Version extraction from labels
- Version extraction from image tag
- Version extraction failure → version: null
- Configuration precedence (enabled > autoDetect)
- RBAC permission errors → detected: false
- Timeout handling → detected: false

### Integration Tests

Test scenarios:
- Install operator → ArgoCD detected in default namespace
- Install operator with custom namespace config → ArgoCD detected in custom namespace
- Install operator with autoDetect: false → ArgoCD not detected
- Install ArgoCD after operator → periodic detection finds it
- Uninstall ArgoCD → periodic detection reflects removal
- Multiple detection cycles → status updates appropriately

### Manual Testing Checklist

- [ ] ArgoCD installed before operator
- [ ] ArgoCD installed after operator
- [ ] ArgoCD in default "argocd" namespace
- [ ] ArgoCD in custom namespace with config
- [ ] ArgoCD with version label
- [ ] ArgoCD without version label
- [ ] Multiple ArgoCD installations
- [ ] autoDetect: false disables detection
- [ ] enabled: true bypasses CRD check
- [ ] VS Code extension reads status correctly
- [ ] Detection survives operator pod restart
- [ ] RBAC permission errors handled gracefully

## Future Considerations

### Phase 2: Data Collection

Once awareness is established, future enhancements will:
- Read ArgoCD Application CR specs and status
- Collect sync status and drift information
- Track Application health and sync errors
- Require additional RBAC permissions (read Applications)

### Phase 3: AI Insights (Pro Tier)

Future Pro tier features will:
- Send sanitized ArgoCD data to kube9-server
- Receive AI-powered drift analysis
- Provide GitOps troubleshooting recommendations
- Offer Application optimization suggestions

## Backwards Compatibility

### Versioning

**Version 1.0.0**: Initial ArgoCD awareness implementation

**Version 1.1.0** (future): May add:
- `argocd.applicationsCount` field
- `argocd.syncStatus` summary
- Backward compatible (optional fields)

### Extension Compatibility

VS Code extensions should:
- Check for presence of `argocd` field in status
- Handle missing `argocd` field (older operators)
- Ignore unknown fields in `argocd` object (forward compatibility)

```typescript
function getArgoCDStatus(status: OperatorStatus): ArgoCDStatus | null {
  // Handle older operators without argocd field
  if (!status.argocd) {
    return null;
  }
  
  return status.argocd;
}
```

