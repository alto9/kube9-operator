---
story_id: create-helm-deployment-template
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: pending
priority: high
estimated_minutes: 30
---

## Objective

Create the Helm template for the operator Deployment with proper configuration and probes.

## Context

The Deployment is the core resource that runs the operator pod with correct configuration, health checks, and resource limits.

## Implementation Steps

1. Create `templates/deployment.yaml`:
   - Single replica (replicas: 1)
   - Strategy: Recreate
   - Use serviceAccount from values
   - Include pod annotations with config/secret checksums

2. Add container spec:
   - Image from values (repository:tag)
   - Pull policy from values
   - Port 8080 for health probes
   - Environment variables for configuration:
     - OPERATOR_NAMESPACE (from fieldRef)
     - LOG_LEVEL
     - STATUS_UPDATE_INTERVAL_SECONDS
     - SERVER_URL
     - API_KEY (from Secret if present)

3. Add liveness probe:
   - HTTP GET /healthz:8080
   - initialDelaySeconds: 30
   - periodSeconds: 10

4. Add readiness probe:
   - HTTP GET /readyz:8080
   - initialDelaySeconds: 10
   - periodSeconds: 5

5. Add resources from values

6. Add security context (run as non-root)

## Files Affected

- `charts/kube9-operator/templates/deployment.yaml` (create)

## Acceptance Criteria

- [ ] Deployment renders correctly
- [ ] All environment variables are set
- [ ] Probes point to correct endpoints
- [ ] Security context is configured
- [ ] Resources are applied from values
- [ ] API_KEY env only present if apiKey in values

## Dependencies

- create-helm-rbac-templates

