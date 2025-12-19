---
task_id: update-documentation-for-namespace-flexibility
session_id: review-and-improve-namespace-management-across-hel
feature_id:
  - status-exposure
spec_id:
  - helm-chart-spec
status: pending
estimated_minutes: 25
---

# Update documentation for namespace flexibility

## Objective

Update README.md and TESTING.md to clarify that the operator can be installed in any namespace, with `kube9-system` as the conventional default.

## Context

Current documentation heavily implies that `kube9-system` is the only namespace option. All examples use `--namespace kube9-system` without mentioning flexibility. Users should understand they can use custom namespaces while recognizing `kube9-system` as the conventional default.

## What Needs to Change

### In README.md

1. **Installation section**: Add note about namespace flexibility
2. **Add custom namespace example**: Show installation in custom namespace
3. **Clarify POD_NAMESPACE**: Mention automatic namespace detection

Example addition after standard installation command:

```markdown
### Installation

#### Standard Installation (Default Namespace)

The operator is conventionally installed in the `kube9-system` namespace:

\`\`\`bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
\`\`\`

#### Custom Namespace Installation

The operator can be installed in any namespace. It will automatically detect its location:

\`\`\`bash
helm install kube9-operator kube9/kube9-operator \
  --namespace my-custom-namespace \
  --create-namespace
\`\`\`

The operator uses the Kubernetes downward API to detect its namespace automatically via the `POD_NAMESPACE` environment variable.
```

### In TESTING.md

1. **Update all test examples**: Add note about namespace flexibility
2. **Add test case**: Installing in custom namespace
3. **Document namespace discovery**: How to verify namespace is correctly detected

Example addition:

```markdown
### Testing Custom Namespace Installation

You can test the operator in any namespace:

\`\`\`bash
# Install in custom namespace
helm install kube9-operator charts/kube9-operator \
  --namespace test-operator \
  --create-namespace

# Verify namespace detection
kubectl get configmap -n test-operator kube9-operator-status -o json | \
  jq -r '.data.status' | jq '.namespace'
# Should output: "test-operator"
\`\`\`
```

## Acceptance Criteria

- [ ] README.md installation section mentions namespace flexibility
- [ ] README.md includes custom namespace installation example
- [ ] TESTING.md includes custom namespace test case
- [ ] Documentation clarifies `kube9-system` is conventional default, not requirement
- [ ] All namespace references updated consistently
- [ ] No broken markdown formatting

## Files to Modify

- `README.md` - Installation and configuration sections
- `TESTING.md` - Testing procedures and examples

## Related Design Documents

- Feature: `ai/features/core/status-exposure.feature.md`
- Spec: `ai/specs/deployment/helm-chart-spec.spec.md`
- See "Namespace Flexibility" section in helm-chart-spec

## Notes

- Keep examples clear and concise
- Maintain consistency with existing documentation style
- Don't change every instance of `kube9-system` - just clarify it's the default
- This task can be done in parallel with code stories (Stories 001-003)

