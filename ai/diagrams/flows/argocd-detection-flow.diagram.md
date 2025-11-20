---
diagram_id: argocd-detection-flow
category: flow
feature_id: [argocd-awareness]
spec_id: [argocd-detection-spec]
---

# ArgoCD Detection Flow

This diagram shows how the operator detects ArgoCD installation at startup and during periodic checks.

```nomnoml
#direction: down
#.operator: fill=#e8f4f8
#.k8s: fill=#d4edda
#.decision: fill=#fff3cd
#.config: fill=#f0e5ff
#.result: fill=#d1ecf1
#.error: fill=#f8d7da

[<start>Operator Startup / Periodic Check]

[<config>Load Helm Configuration|autoDetect|enabled|namespace|selector|detectionInterval]

[<decision>Detection Disabled?|enabled: false OR|autoDetect: false]
[<result>Set detected: false|Skip detection]

[<decision>Explicitly Enabled?|enabled: true]
[<operator>Direct Namespace Check|Skip CRD verification]

[<k8s>Check for Application CRD|applications.argoproj.io]
[<decision>CRD Exists?]
[<result>Set detected: false|No ArgoCD CRD]

[<k8s>Determine Target Namespace|From config or default "argocd"]
[<k8s>Check Namespace Exists]
[<decision>Namespace Exists?]
[<result>Set detected: false|Namespace not found]

[<k8s>List Deployments|With label selector|app.kubernetes.io/name=argocd-server]
[<decision>Deployment Found?]
[<result>Set detected: false|ArgoCD server not found]

[<operator>Extract Version|From labels or image tag]
[<result>Set detected: true|namespace: argocd|version: v2.8.0]

[<operator>Update OperatorStatus|Write to ConfigMap]
[<operator>Log Detection Result]

[<decision>Status Changed?|Compare with previous]
[<operator>Skip Update|No change detected]

[<error>API Error Handling|RBAC / Timeout / Network]
[<result>Set detected: false|Log warning, continue]

[Operator Startup / Periodic Check] -> [Load Helm Configuration]
[Load Helm Configuration] -> [Detection Disabled?]

[Detection Disabled?] YES -> [Set detected: false]
[Detection Disabled?] NO -> [Explicitly Enabled?]

[Explicitly Enabled?] YES -> [Direct Namespace Check]
[Explicitly Enabled?] NO -> [Check for Application CRD]

[Check for Application CRD] -> [CRD Exists?]
[CRD Exists?] NO -> [Set detected: false]
[CRD Exists?] YES -> [Determine Target Namespace]

[Direct Namespace Check] -> [Determine Target Namespace]
[Determine Target Namespace] -> [Check Namespace Exists]

[Check Namespace Exists] -> [Namespace Exists?]
[Namespace Exists?] NO -> [Set detected: false]
[Namespace Exists?] YES -> [List Deployments]

[List Deployments] -> [Deployment Found?]
[Deployment Found?] NO -> [Set detected: false]
[Deployment Found?] YES -> [Extract Version]

[Extract Version] -> [Set detected: true]
[Set detected: true] -> [Status Changed?]
[Set detected: false] -> [Status Changed?]

[Status Changed?] NO -> [Skip Update]
[Status Changed?] YES -> [Update OperatorStatus]
[Update OperatorStatus] -> [Log Detection Result]

[Check for Application CRD] Error -> [API Error Handling]
[Check Namespace Exists] Error -> [API Error Handling]
[List Deployments] Error -> [API Error Handling]
[API Error Handling] -> [Set detected: false]

[Skip Update] -> [<end>Complete]
[Log Detection Result] -> [<end>Complete]
```

## Detection Flow Details

### Phase 1: Configuration Loading

The operator loads ArgoCD configuration from Helm values:

```yaml
argocd:
  autoDetect: true
  # enabled: true
  # namespace: "argocd"
  # selector: "app.kubernetes.io/name=argocd-server"
  detectionInterval: 6
```

Configuration determines the detection path:
- **autoDetect: false** → Skip all detection
- **enabled: false** → Skip all detection (explicit override)
- **enabled: true** → Skip CRD check, go directly to namespace
- **Default** → Full detection with CRD check

### Phase 2: CRD Verification (Default Path)

Check if ArgoCD's Application CRD exists:

```typescript
const crd = await k8sClient.apiextensions.getCustomResourceDefinition(
  "applications.argoproj.io"
);
```

**CRD Found**:
- ArgoCD likely installed
- Proceed to namespace check

**CRD Not Found**:
- ArgoCD not installed
- Set detected: false
- Skip further checks

### Phase 3: Namespace Determination

Determine which namespace to check:

**Priority Order**:
1. `argocd.namespace` from Helm values
2. Default `"argocd"` namespace

**Namespace Check**:
```typescript
const namespace = config.namespace || "argocd";
const ns = await k8sClient.core.readNamespace(namespace);
```

### Phase 4: Deployment Verification

Check for ArgoCD server deployment:

```typescript
const selector = config.selector || "app.kubernetes.io/name=argocd-server";
const deployments = await k8sClient.apps.listNamespacedDeployment(
  namespace,
  undefined,
  undefined,
  undefined,
  undefined,
  selector
);
```

**Deployment Found**:
- ArgoCD confirmed installed
- Proceed to version extraction

**Deployment Not Found**:
- ArgoCD not in expected location
- Set detected: false

### Phase 5: Version Extraction

Extract ArgoCD version from deployment:

**Method 1: Check Labels**:
```typescript
const labels = deployment.metadata?.labels || {};
const version = labels["app.kubernetes.io/version"] ||
                labels["argocd.argoproj.io/version"] ||
                labels["version"];
```

**Method 2: Parse Image Tag**:
```typescript
const container = deployment.spec.template.spec.containers
  .find(c => c.name === "argocd-server");
const imageMatch = container.image.match(/:v?(\d+\.\d+\.\d+)/);
```

**Result**:
- Version found: Set `argocd.version`
- Version not found: Set `argocd.version: null`

### Phase 6: Status Update

Compare new detection result with previous:

```typescript
const hasChanged = 
  currentStatus.detected !== newStatus.detected ||
  currentStatus.namespace !== newStatus.namespace ||
  currentStatus.version !== newStatus.version;

if (hasChanged) {
  await updateOperatorStatus({ argocd: newStatus });
  logger.info("ArgoCD status changed", { 
    previous: currentStatus,
    current: newStatus 
  });
}
```

**Status Update Required**:
- Detection result changed
- Update OperatorStatus ConfigMap
- Log the change

**No Update Needed**:
- Detection result unchanged
- Skip ConfigMap update
- Continue normal operation

### Error Handling

All Kubernetes API errors are caught and handled gracefully:

**RBAC Permission Error (403)**:
```
[WARN] Insufficient permissions for ArgoCD detection
Result: detected: false
Behavior: Continue operation, retry on next cycle
```

**Timeout Error**:
```
[WARN] ArgoCD detection timed out after 30s
Result: detected: false
Behavior: Continue operation, retry on next cycle
```

**Network Error**:
```
[WARN] Error checking for ArgoCD: connection refused
Result: detected: false
Behavior: Continue operation, retry on next cycle
```

**API Server Unavailable (503)**:
```
[WARN] Kubernetes API unavailable during ArgoCD detection
Result: detected: false
Behavior: Continue operation, retry on next cycle
```

### Periodic Detection

After startup, detection runs periodically:

**Timing**:
- Default: Every 6 hours
- Configurable via `argocd.detectionInterval`
- Minimum: 1 hour
- Maximum: 24 hours

**Execution**:
```typescript
setInterval(async () => {
  const newStatus = await detectArgoCD(config);
  
  if (hasStatusChanged(currentStatus, newStatus)) {
    await updateOperatorStatus({ argocd: newStatus });
  }
}, detectionIntervalMs);
```

**Use Cases**:
- ArgoCD installed after operator starts
- ArgoCD uninstalled while operator running
- ArgoCD upgraded (version changes)
- ArgoCD moved to different namespace

## Status Transitions

### Startup: ArgoCD Already Installed

```
[Operator Start] → [Detect ArgoCD] → [Update Status]
Status: { detected: true, namespace: "argocd", version: "v2.8.0" }
```

### Startup: ArgoCD Not Installed

```
[Operator Start] → [Detect ArgoCD] → [Update Status]
Status: { detected: false, namespace: null, version: null }
```

### Runtime: ArgoCD Installed

```
[Periodic Check] → [ArgoCD Found] → [Status Changed] → [Update Status]
Previous: { detected: false }
New: { detected: true, namespace: "argocd", version: "v2.8.0" }
```

### Runtime: ArgoCD Uninstalled

```
[Periodic Check] → [ArgoCD Not Found] → [Status Changed] → [Update Status]
Previous: { detected: true, namespace: "argocd" }
New: { detected: false, namespace: null, version: null }
```

### Runtime: ArgoCD Upgraded

```
[Periodic Check] → [Version Changed] → [Status Changed] → [Update Status]
Previous: { detected: true, version: "v2.8.0" }
New: { detected: true, version: "v2.9.0" }
```

### Runtime: No Change

```
[Periodic Check] → [Same Result] → [Skip Update]
Status: Unchanged
```

## OperatorStatus Result

The detection result is exposed in OperatorStatus:

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

VS Code extension reads this status and:
- Shows/hides ArgoCD tree view section
- Enables/disables ArgoCD commands
- Displays ArgoCD status badge
- Provides installation guidance if not detected

## Configuration Examples

### Default Auto-Detection

```yaml
# Helm values.yaml
argocd:
  autoDetect: true
```

**Behavior**:
- Check for Application CRD
- Check "argocd" namespace
- Detect version from deployment

### Custom Namespace

```yaml
argocd:
  autoDetect: true
  namespace: "gitops"
```

**Behavior**:
- Check for Application CRD
- Check "gitops" namespace (custom)
- Detect version from deployment

### Explicit Enable

```yaml
argocd:
  enabled: true
  namespace: "argocd"
```

**Behavior**:
- Skip CRD check
- Directly check "argocd" namespace
- Faster detection

### Disabled Detection

```yaml
argocd:
  autoDetect: false
```

**Behavior**:
- No detection performed
- Always returns detected: false
- Zero RBAC requirements

### Custom Detection Interval

```yaml
argocd:
  autoDetect: true
  detectionInterval: 12
```

**Behavior**:
- Check every 12 hours (instead of default 6)
- Less frequent API calls
- Slower to detect changes

