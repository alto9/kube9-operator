# Helm Chart Testing Guide

This guide provides step-by-step instructions for manually testing the kube9-operator Helm chart.

## Prerequisites

- Helm 3.x installed
- kubectl installed
- Kind installed (for local testing) OR access to a Kubernetes cluster
- jq installed (for JSON parsing)

## Quick Test Script

Run the automated test script:

```bash
./scripts/test-helm-chart.sh
```

## Manual Testing Steps

### Phase 1: Default install

1. **Start a local Kind cluster:**
   ```bash
   kind create cluster --name kube9-test
   ```

2. **Install chart:**
   ```bash
   helm install kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --create-namespace
   ```

3. **Verify operator pod starts successfully:**
   ```bash
   kubectl wait --for=condition=ready pod \
     -l app.kubernetes.io/name=kube9-operator \
     -n kube9-system \
     --timeout=120s
   ```

4. **Verify status ConfigMap is created with mode="operated":**
   ```bash
   sleep 10

   kubectl get configmap kube9-operator-status -n kube9-system -o yaml

   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq -r '.mode'
   # Expected: "operated"

   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq -r '.tier'
   # Expected: "free"
   ```

5. **Verify no chart-managed operator credential Secret:**
   ```bash
   kubectl get secret kube9-operator-config -n kube9-system
   # Expected: Error: secrets "kube9-operator-config" not found
   ```

6. **Check operator logs for any errors:**
   ```bash
   kubectl logs -n kube9-system deployment/kube9-operator
   ```

7. **Verify post-install notes:**
   ```bash
   helm get notes kube9-operator -n kube9-system
   ```

### Testing custom namespace installation

The operator detects its namespace via the downward API and advertises it in the status ConfigMap:

1. **Install in custom namespace:**
   ```bash
   helm install kube9-operator charts/kube9-operator \
     --namespace test-operator \
     --create-namespace
   ```

2. **Verify namespace detection:**
   ```bash
   sleep 10

   kubectl get configmap kube9-operator-status -n test-operator -o json | \
     jq -r '.data.status' | jq '.namespace'
   # Should output: "test-operator"

   kubectl get configmap kube9-operator-status -n test-operator \
     -o jsonpath='{.data.status}' | jq -r '.mode'
   # Expected: "operated"
   ```

3. **Clean up custom namespace installation:**
   ```bash
   helm uninstall kube9-operator --namespace test-operator
   ```

**Note:** All phases below can be run in a custom namespace by replacing `kube9-system` with your chosen namespace. The operator detects its namespace via the downward API.

### Phase 2: Optional values / upgrade smoke test

1. **Upgrade with extra values (example: shorter status interval):**
   ```bash
   helm upgrade kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --reuse-values \
     --set statusUpdateIntervalSeconds=30
   ```

2. **Wait for pod ready:**
   ```bash
   kubectl wait --for=condition=ready pod \
     -l app.kubernetes.io/name=kube9-operator \
     -n kube9-system \
     --timeout=120s
   ```

3. **Verify operator logs show successful startup (no kube9-server registration):**
   ```bash
   kubectl logs -n kube9-system deployment/kube9-operator --tail=80
   ```

4. **Verify status ConfigMap shape:**
   ```bash
   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq '.'
   # Expect mode "operated", tier "free", health "healthy" by default
   ```

### Phase 3: Helm commands

1. **Run helm lint:**
   ```bash
   helm lint charts/kube9-operator
   ```

2. **Run helm template (no operator credential Secret, no `API_KEY` env):**
   ```bash
   helm template kube9-operator charts/kube9-operator \
     --namespace kube9-system > /tmp/rendered.yaml

   grep -E 'kind: Secret|API_KEY' /tmp/rendered.yaml && echo 'Unexpected Secret or API_KEY' && exit 1 || true
   ```

3. **Test with custom values.yaml (no apiKey):**
   ```bash
   cat > /tmp/test-values.yaml <<EOF
   logLevel: debug
   statusUpdateIntervalSeconds: 30
   EOF

   helm template kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     -f /tmp/test-values.yaml
   ```

4. **Test upgrade preserves configuration:**
   ```bash
   helm install kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --create-namespace \
     --set logLevel=debug

   helm upgrade kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --reuse-values

   kubectl get deployment kube9-operator -n kube9-system \
     -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="LOG_LEVEL")].value}'
   # Expected: "debug"
   ```

5. **Test uninstall removes chart-owned resources:**
   ```bash
   helm uninstall kube9-operator --namespace kube9-system

   kubectl get deployment kube9-operator -n kube9-system
   # Expected: Error: deployments.apps "kube9-operator" not found

   kubectl get secret kube9-operator-config -n kube9-system
   # Expected: Error: secrets "kube9-operator-config" not found
   ```

   The status ConfigMap may remain until deleted manually (created by the operator).

### Phase 4: Packaging

1. **Package the chart:**
   ```bash
   helm package charts/kube9-operator
   ```

2. **Verify package artifact:**
   ```bash
   ls -lh kube9-operator-*.tgz
   ```

3. **Test installing from package:**
   ```bash
   helm install kube9-operator kube9-operator-*.tgz \
     --namespace kube9-system \
     --create-namespace

   kubectl wait --for=condition=ready pod \
     -l app.kubernetes.io/name=kube9-operator \
     -n kube9-system \
     --timeout=120s

   helm uninstall kube9-operator --namespace kube9-system
   ```

### Phase 5: Cleanup

```bash
kind delete cluster --name kube9-test
```

## Expected results summary

- No chart-managed Secret named `kube9-operator-config` and no `API_KEY` environment variable in rendered manifests for default values
- Status ConfigMap reports `mode="operated"` and `tier="free"` for default install when healthy
- Pod reaches Ready without crash loops; operator does **not** log kube9-server registration or `/v1/collections` transmission
- `helm lint` passes; upgrade with `--reuse-values` preserves prior values
- Optional API key / custom values (when the chart exposes them): deployment updates apply, pod **Ready**, status fields unchanged for default product constants

## Troubleshooting

### Operator pod not starting

- Check logs: `kubectl logs -n kube9-system deployment/kube9-operator`
- Verify RBAC: `kubectl get role,rolebinding,clusterrole,clusterrolebinding -n kube9-system`
- Check image: `kubectl describe pod -n kube9-system -l app.kubernetes.io/name=kube9-operator`

### Status ConfigMap not created
- Wait longer (operator updates on the configured interval)
- Check operator logs for errors
- Verify RBAC permissions allow ConfigMap creation in the release namespace

## Completion checklist

### Status looks wrong
- Confirm RBAC allows ConfigMap create/update in `POD_NAMESPACE`
- Inspect `health` and `error` fields in the status JSON

- [ ] Default installation works
- [ ] `helm lint` passes with no errors
- [ ] `helm template` renders with no operator credential Secret and no `API_KEY` env var for default values
- [ ] Upgrade with `--reuse-values` works correctly
- [ ] Uninstall removes chart-owned workload objects
- [ ] Package created successfully
- [ ] Package install works correctly
