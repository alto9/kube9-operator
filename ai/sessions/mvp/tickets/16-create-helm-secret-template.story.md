---
story_id: create-helm-secret-template
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: pending
priority: high
estimated_minutes: 15
---

## Objective

Create the conditional Helm template for the operator configuration Secret containing the API key.

## Context

When a user provides an API key via `--set apiKey=...`, it must be stored in a Kubernetes Secret that the operator can read.

## Implementation Steps

1. Create `templates/secret.yaml`:
   - Conditional: `{{- if .Values.apiKey }}`
   - Type: Opaque
   - Name: `{{ include "kube9-operator.fullname" . }}-config`
   - Namespace: `{{ .Release.Namespace }}`

2. Add stringData (not data, Helm will encode):
   - apiKey: `{{ .Values.apiKey | quote }}`

3. Include proper labels using helpers

4. Test that Secret is NOT created when apiKey is empty

5. Test that Secret IS created when apiKey is provided

## Files Affected

- `charts/kube9-operator/templates/secret.yaml` (create)

## Acceptance Criteria

- [ ] Secret only created if apiKey in values
- [ ] Secret name matches operator expectation
- [ ] apiKey is properly stored
- [ ] Secret has correct namespace
- [ ] Labels are applied

## Dependencies

- create-helm-chart-structure

