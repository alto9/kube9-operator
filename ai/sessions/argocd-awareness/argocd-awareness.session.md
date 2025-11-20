---
session_id: argocd-awareness
start_time: '2025-11-20T14:50:13.011Z'
status: development
problem_statement: >-
  Enable kube9-operator to detect and track ArgoCD installation status as part
  of cluster status reporting
changed_files:
  - path: ai/features/core/argocd-awareness.feature.md
    change_type: added
    scenarios_added:
      - ArgoCD detected in default namespace
      - ArgoCD detected in custom namespace
      - ArgoCD not installed
      - ArgoCD detection disabled via configuration
      - ArgoCD explicitly enabled via configuration
      - Periodic ArgoCD detection
      - ArgoCD installed after operator starts
      - ArgoCD uninstalled after detection
      - Detection failure handling
      - VS Code extension reads ArgoCD status
      - VS Code extension when ArgoCD not detected
      - Detection with insufficient RBAC permissions
      - Multiple ArgoCD installations
      - Version detection from deployment
      - Version detection failure
start_commit: a6f66dd71787da46613b104e97e6bb25e53b7f33
end_time: '2025-11-20T15:01:39.296Z'
---

## Problem Statement

kube9 aims to provide seamless integration with ArgoCD to enhance drift detection and provide AI-powered GitOps insights. As a first step, the operator needs to be aware of whether ArgoCD is installed in the cluster and expose this information through the OperatorStatus CRD.

Currently, the operator tracks basic cluster status (tier, health, operator version, etc.), but has no awareness of ArgoCD presence. This prevents the VS Code extension from conditionally enabling ArgoCD-related features and prevents the operator from collecting ArgoCD-specific data for Pro tier AI insights.

## Goals

1. **Detect ArgoCD Installation**: Operator should automatically detect if ArgoCD is installed in the cluster
2. **Configurable Detection**: Allow users to override default detection with Helm values configuration
3. **Status Reporting**: Expose ArgoCD awareness through OperatorStatus CRD so VS Code extension can adapt UI
4. **Foundation for Integration**: Create the groundwork for future ArgoCD data collection and AI insights
5. **Non-Breaking**: Detection should work without requiring ArgoCD to be installed (graceful degradation)

## Approach

### Detection Strategy

**Default Detection**:
- Check for ArgoCD's standard namespace (`argocd`)
- Look for ArgoCD's ApplicationSet CRD or core Application CRD
- Verify ArgoCD server deployment exists
- Detection runs during operator startup and periodically (e.g., every 6 hours)

**Configurable Detection**:
- Users can specify custom ArgoCD namespace via Helm values (`argocd.namespace`)
- Users can override detection entirely with explicit flag (`argocd.enabled: true/false`)
- Users can provide custom label selectors for ArgoCD detection

### Status Exposure

Add to OperatorStatus CRD:
```yaml
status:
  argocd:
    detected: true/false
    namespace: "argocd"  # or custom namespace
    version: "v2.8.0"    # if detectable from server deployment
    lastChecked: "2025-11-20T14:50:13Z"
```

### Helm Configuration

Add to values.yaml:
```yaml
argocd:
  # Auto-detect ArgoCD installation (default: true)
  autoDetect: true
  
  # Explicitly enable/disable ArgoCD integration (overrides autoDetect)
  # enabled: true
  
  # Custom namespace where ArgoCD is installed (default: "argocd")
  # namespace: "custom-argocd-ns"
  
  # Custom label selector for ArgoCD server deployment
  # selector: "app.kubernetes.io/name=argocd-server"
```

### Implementation Layers

1. **Detection Module**: New module for ArgoCD discovery logic
2. **Status Manager Update**: Extend status manager to include ArgoCD status
3. **CRD Update**: Extend OperatorStatus CRD schema with argocd field
4. **Configuration Handling**: Parse and apply Helm values for ArgoCD configuration
5. **Periodic Refresh**: Re-check ArgoCD status on schedule (every 6 hours)

## Key Decisions

### 1. Detection Method: CRD-Based vs Deployment-Based
**Decision**: Use **CRD-based detection as primary**, with deployment verification as secondary

**Rationale**:
- ArgoCD's Application CRD is unique and reliable identifier
- CRD presence is more stable than checking for specific deployments
- Deployment names could vary in custom installations
- CRDs are globally available (cluster-scoped), easier to check

**Implementation**: Check for `applications.argoproj.io` CRD, then verify `argocd-server` deployment

### 2. Default Namespace: Hardcoded vs Discovery
**Decision**: **Default to "argocd" namespace**, but support user override via Helm values

**Rationale**:
- 95%+ of ArgoCD installations use default "argocd" namespace
- Simplifies initial detection logic
- Users with custom namespaces can easily configure override
- Reduces complexity for common case

### 3. Detection Frequency: On-Demand vs Periodic
**Decision**: **Hybrid approach** - detect on startup + periodic refresh every 6 hours

**Rationale**:
- Startup detection ensures status is current on operator pod restart
- Periodic refresh catches ArgoCD installations that happen after operator starts
- 6-hour interval balances freshness with resource usage
- VS Code extension can display last checked timestamp

### 4. Status Reporting: Boolean vs Detailed
**Decision**: **Detailed status** including detected, namespace, version, lastChecked

**Rationale**:
- Boolean alone is insufficient for debugging
- Namespace info helps users understand what was detected
- Version info enables future version-specific features
- lastChecked timestamp shows staleness
- Detailed info aids troubleshooting

### 5. Configuration Precedence
**Decision**: Explicit `argocd.enabled` > `autoDetect` > default behavior

**Rationale**:
- Users who explicitly set enabled=false should always be respected
- Users who explicitly set enabled=true should bypass detection
- autoDetect=false allows disabling feature entirely
- Clear precedence hierarchy prevents confusion

### 6. Failure Handling: Silent vs Reported
**Decision**: **Log warnings but don't fail** if ArgoCD detection fails

**Rationale**:
- ArgoCD detection failing should not impact core operator functionality
- Operator should work perfectly fine without ArgoCD present
- Logs provide debugging info for users who expect ArgoCD
- Graceful degradation maintains reliability

### 7. RBAC Permissions
**Decision**: **Minimal RBAC** - read-only access to CRDs and deployments in ArgoCD namespace

**Rationale**:
- Detection only requires read permissions
- Limit scope to ArgoCD namespace (if specified) or cluster-wide CRD list
- No write permissions needed for awareness phase
- Follows principle of least privilege

## Notes

### Future Considerations

**Phase 2 - Data Collection**:
- Once awareness is established, next phase will collect ArgoCD application status
- Will need to read Application CR specs and status
- May require additional RBAC permissions

**Phase 3 - AI Insights**:
- Collected ArgoCD data will be sanitized and sent to kube9-server (Pro tier)
- Server will provide drift analysis and troubleshooting recommendations
- Insights will be returned through OperatorStatus CRD

### VS Code Extension Integration

The VS Code extension will read `status.argocd.detected` from OperatorStatus CRD and:
- Show/hide ArgoCD tree view section
- Display ArgoCD status badge
- Enable ArgoCD-specific commands conditionally
- Show "ArgoCD not detected" message if user expects it

### Backwards Compatibility

- New CRD fields are optional and backwards compatible
- Operators upgrading from previous version will start with `argocd.detected: false`
- Detection will run on first periodic check after upgrade
- No breaking changes to existing functionality

### Testing Considerations

Need to test:
1. ArgoCD installed in default namespace
2. ArgoCD installed in custom namespace (with config)
3. ArgoCD not installed at all
4. ArgoCD installed after operator starts (periodic detection)
5. ArgoCD uninstalled after detection (status should reflect removal)
6. Multiple ArgoCD installations (edge case - detect primary only)

### Documentation Requirements

Will need to document in operator README:
- How ArgoCD detection works
- Helm values for configuration
- Troubleshooting if detection fails
- RBAC requirements for ArgoCD awareness

### Related Strategic Goals

From kube9 vision documents:
- **Operator Vision**: "Enhanced ArgoCD Integration: Seamless integration with ArgoCD for enhanced drift detection and AI-powered GitOps insights"
- **Extension Vision**: "ArgoCD Integration: Seamless integration with ArgoCD for enhanced drift detection and AI-powered GitOps insights"
- **Strategic Vision**: "GitOps Integration: Seamless integration with ArgoCD and other GitOps tools for enhanced drift detection and AI-powered insights"

This awareness session is the foundation for delivering on these strategic goals.
