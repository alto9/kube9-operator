---
task_id: update-operator-readme
session_id: argocd-awareness
type: documentation
status: pending
priority: low
---

## Description

Update the operator README to document ArgoCD awareness feature, configuration options, and troubleshooting.

## Reason

The README is the primary documentation for the operator. Users need to understand the ArgoCD awareness feature, how to configure it, and how to troubleshoot issues.

## Steps

1. Open `README.md` in the operator repository
2. Add new "ArgoCD Awareness" section after existing features
3. Document configuration options:
   - autoDetect (default: true)
   - enabled (optional override)
   - namespace (default: "argocd")
   - selector (default: "app.kubernetes.io/name=argocd-server")
   - detectionInterval (default: 6 hours)
4. Add configuration examples:
   - Default auto-detection
   - Custom namespace
   - Explicit enable/disable
   - Custom detection interval
5. Add troubleshooting section:
   - ArgoCD not detected when it should be
   - Permission errors (RBAC)
   - How to check detection status
6. Add example of checking OperatorStatus for argocd field

## Resources

- `README.md` - File to update
- Session documents for accurate feature description
- Spec file for configuration details

## Completion Criteria

- [ ] README includes "ArgoCD Awareness" section
- [ ] All configuration options documented with defaults
- [ ] Configuration examples provided (YAML)
- [ ] Troubleshooting section added
- [ ] Example of reading argocd status from ConfigMap
- [ ] RBAC requirements mentioned
- [ ] Links to relevant documentation
- [ ] Markdown formatting is correct

## Dependencies

- Story 001 (add-argocd-helm-config) - Need final configuration structure

## Notes

- Keep documentation concise but complete
- Use code blocks for YAML examples
- Include kubectl commands for checking status
- Follow existing README structure and style
- Example: `kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq '.argocd'`

