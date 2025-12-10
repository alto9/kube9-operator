---
story_id: update-chart-yaml-repository-url
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - chart-repository-hosting
spec_id:
  - helm-chart-spec
status: pending
---

# Update Chart.yaml Repository URL to charts.kube9.io

## Objective

Update Chart.yaml to reference charts.kube9.io as the repository URL in sources field.

## Context

The Chart.yaml currently references charts.kube9.dev, but the new infrastructure uses charts.kube9.io. This ensures consistency between the chart metadata and the actual repository location.

## Files to Modify

- `charts/kube9-operator/Chart.yaml`

## Implementation Steps

1. Update sources field in Chart.yaml to use https://charts.kube9.io
2. Verify repository URL matches infrastructure domain

## Acceptance Criteria

- [ ] Chart.yaml sources field updated to charts.kube9.io
- [ ] URL uses HTTPS protocol
- [ ] Chart still validates with helm lint

## Estimated Time

< 15 minutes

