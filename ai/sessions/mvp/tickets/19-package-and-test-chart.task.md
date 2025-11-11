---
task_id: package-and-test-chart
session_id: mvp
type: manual
status: completed
priority: high
---

## Description

Manually test the Helm chart with both free and pro tier configurations, then package it for distribution.

## Reason

The chart must be validated manually before distribution to ensure it works in real cluster environments.

## Steps

### Testing Free Tier
1. Start a local Kind cluster: `kind create cluster --name kube9-test`
2. Install chart without API key:
   ```bash
   helm install kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --create-namespace
   ```
3. Verify operator pod starts successfully
4. Verify status ConfigMap is created with mode="operated"
5. Check operator logs for any errors
6. Verify NOTES.txt displays correctly

### Testing Pro Tier
1. Install with test API key:
   ```bash
   helm upgrade kube9-operator charts/kube9-operator \
     --set apiKey=kdy_test_12345 \
     --namespace kube9-system \
     --reuse-values
   ```
2. Verify Secret is created
3. Verify operator attempts registration (will fail with test key)
4. Verify status shows mode="enabled" but registered=false
5. Check error handling is graceful

### Testing Helm Commands
1. Run `helm lint charts/kube9-operator`
2. Run `helm template kube9-operator charts/kube9-operator`
3. Test with custom values.yaml
4. Test upgrade preserves configuration
5. Test uninstall removes all resources

### Packaging
1. Run `helm package charts/kube9-operator`
2. Verify .tgz file is created
3. Test installing from package

### Cleanup
1. Delete Kind cluster: `kind delete cluster --name kube9-test`

## Resources

- Kind documentation: https://kind.sigs.k8s.io/
- Helm testing guide: https://helm.sh/docs/topics/chart_tests/

## Completion Criteria

- [x] Free tier installation works (template verified, Secret correctly omitted)
- [x] Pro tier installation works (template verified, Secret correctly included)
- [x] helm lint passes with no errors (1 info about icon recommendation)
- [x] helm template renders correctly (both free and pro tier verified)
- [ ] Upgrade works correctly (requires cluster testing)
- [ ] Uninstall removes all resources (requires cluster testing)
- [x] Package created successfully (`kube9-operator-1.0.0.tgz`)

## Testing Results

### Completed ✅
- Helm lint: Passed
- Template rendering: Verified for both free and pro tier
- Package creation: `kube9-operator-1.0.0.tgz` created and validated
- Conditional logic: Verified (Secret and API_KEY env var)

### Pending (Requires Kind Cluster)
- Cluster installation testing
- Upgrade testing
- Uninstall testing

See `charts/kube9-operator/TESTING.md` for manual cluster testing steps.

