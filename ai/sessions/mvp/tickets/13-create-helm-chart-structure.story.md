---
story_id: create-helm-chart-structure
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: completed
priority: high
estimated_minutes: 20
---

## Objective

Create the basic Helm chart structure with Chart.yaml, values.yaml, and helper templates.

## Context

The operator is deployed via Helm chart. This story sets up the foundational chart structure following Helm best practices.

## Implementation Steps

1. Create directory: `charts/kube9-operator/`

2. Create `charts/kube9-operator/Chart.yaml`:
   - apiVersion: v2
   - name: kube9-operator
   - version: 1.0.0
   - appVersion: "1.0.0"
   - description: Kubernetes Operator for kube9 VS Code Extension
   - keywords: kubernetes, vscode, operator
   - home: https://kube9.dev
   - kubeVersion: ">= 1.24.0"

3. Create `charts/kube9-operator/values.yaml` with:
   - apiKey: "" (optional)
   - image: repository, tag, pullPolicy
   - resources: requests and limits
   - serviceAccount: create, name
   - rbac: create
   - logLevel: info
   - statusUpdateIntervalSeconds: 60
   - serverUrl: https://api.kube9.dev

4. Create `charts/kube9-operator/templates/_helpers.tpl`:
   - Template for fullname
   - Template for labels
   - Template for selector labels
   - Template for service account name

5. Create `.helmignore`

## Files Affected

- `charts/kube9-operator/Chart.yaml` (create)
- `charts/kube9-operator/values.yaml` (create)
- `charts/kube9-operator/templates/_helpers.tpl` (create)
- `charts/kube9-operator/.helmignore` (create)

## Acceptance Criteria

- [ ] Chart.yaml is valid
- [ ] values.yaml has all required fields
- [ ] Helper templates compile
- [ ] `helm lint` passes

## Dependencies

None

