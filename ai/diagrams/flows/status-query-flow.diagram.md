---
diagram_id: status-query-flow
category: flow
---

# Extension Status Query Flow

This diagram shows how the VS Code extension queries the operator status to determine cluster tier.

```nomnoml
#direction: down
#.extension: fill=#e8f4f8
#.k8s: fill=#d4edda
#.decision: fill=#fff3cd
#.result: fill=#f8d7da

[<start>Extension Needs Status]

[<extension>Check Cache]
[<decision>Cache Valid?|< 5 min old]
[<extension>Return Cached Status]

[<k8s>Query Kubernetes API|kubectl get configmap|kube9-operator-status|-n kube9-system]
[<decision>ConfigMap Found?]

[<result>Return: basic mode|No operator installed]

[<k8s>Read ConfigMap Data]
[<extension>Parse JSON Status]

[<decision>Timestamp Fresh?|< 5 min old]

[<result>Return: degraded|Status too old]

[<extension>Update Cache|Store for 5 min]
[<extension>Enable Features|Based on tier]

[Extension Needs Status] -> [Check Cache]
[Check Cache] -> [Cache Valid?]
[Cache Valid?] YES -> [Return Cached Status]
[Cache Valid?] NO -> [Query Kubernetes API]

[Query Kubernetes API] -> [ConfigMap Found?]
[ConfigMap Found?] NO -> [Return: basic mode]
[ConfigMap Found?] YES -> [Read ConfigMap Data]

[Read ConfigMap Data] -> [Parse JSON Status]
[Parse JSON Status] -> [Timestamp Fresh?]

[Timestamp Fresh?] YES -> [Update Cache]
[Timestamp Fresh?] NO -> [Return: degraded]

[Update Cache] -> [Enable Features]
[Return: basic mode] -> [Enable Features]
[Return Cached Status] -> [Enable Features]
[Return: degraded] -> [Enable Features]
```

## Query Flow Details

### 1. Cache Check
Extension first checks its local cache to avoid unnecessary API calls:
- **Cache Hit (< 5 min old)**: Return cached status immediately
- **Cache Miss or Expired**: Proceed to query cluster

### 2. Operator Detection
Extension uses kubectl to check for operator ConfigMap:
```bash
kubectl get configmap kube9-operator-status \
  -n kube9-system \
  -o json
```

### 3. Status Interpretation

**ConfigMap Not Found**:
- Operator is not installed
- Return mode: "basic"
- Features: kubectl-only operations
- UI: Show installation prompts

**ConfigMap Found - Fresh Status**:
- Parse JSON from ConfigMap data
- Return mode: "operated" or "enabled"
- Features: Enable based on tier
- UI: Show appropriate interface

**ConfigMap Found - Stale Status**:
- Status timestamp > 5 minutes old
- Operator may be unhealthy
- Return mode: "degraded"
- Features: Limited feature set
- UI: Show health warning

### 4. Feature Enablement

Based on tier from status:

**basic** (no operator):
- Tree view with namespaces
- kubectl command execution
- Read-only resource viewing
- No dashboards or AI features

**operated** (free tier):
- All basic features
- Local HTML webviews
- Simple resource editing
- No AI features
- Show upgrade prompts

**enabled** (pro tier):
- All operated features
- Rich web UIs from kube9-server
- AI-powered recommendations
- Advanced dashboards
- Historical metrics

**degraded**:
- Fall back to basic features
- Show health warnings
- Prompt to check operator logs

### 5. Cache Update
- Store status in memory
- Set cache timestamp
- Cache expires after 5 minutes
- Manual refresh clears cache

## Status ConfigMap Format

```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.0.0",
  "health": "healthy",
  "lastUpdate": "2025-11-10T15:30:00Z",
  "registered": true,
  "error": null
}
```

## Extension Cache Strategy

- **TTL**: 5 minutes
- **Storage**: In-memory only (no persistent cache)
- **Invalidation**: Manual refresh, window reload, or TTL expiry
- **Fallback**: On error, assume "basic" mode

