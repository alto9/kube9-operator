---
story_id: create-helm-notes-template
session_id: mvp
feature_id: [helm-installation]
spec_id: [helm-chart-spec]
model_id: []
status: completed
priority: low
estimated_minutes: 15
---

## Objective

Create the NOTES.txt template that displays helpful information after Helm install/upgrade.

## Context

After installation, users should see clear instructions about what was installed and next steps.

## Implementation Steps

1. Create `templates/NOTES.txt`:
   - Thank you message
   - Release name
   - Conditional message based on apiKey presence:
     - With key: "✅ Pro Tier enabled"
     - Without key: "ℹ️  Free Tier - instructions to upgrade"

2. Include commands to:
   - Check operator status
   - View operator logs
   - View status ConfigMap

3. Add link to documentation: https://docs.kube9.dev

4. Include upgrade instructions if in free tier

## Files Affected

- `charts/kube9-operator/templates/NOTES.txt` (create)

## Acceptance Criteria

- [ ] Notes display after `helm install`
- [ ] Conditional messages work correctly
- [ ] Commands are accurate
- [ ] Instructions are helpful

## Dependencies

- create-helm-chart-structure

