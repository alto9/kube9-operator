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

### Phase 1: Free Tier Testing

1. **Start a local Kind cluster:**
   ```bash
   kind create cluster --name kube9-test
   ```

2. **Install chart without API key:**
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
   # Wait a few seconds for operator to create ConfigMap
   sleep 10
   
   kubectl get configmap kube9-operator-status -n kube9-system -o yaml
   
   # Verify mode
   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq -r '.mode'
   # Expected: "operated"
   
   # Verify tier
   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq -r '.tier'
   # Expected: "free"
   ```

5. **Verify Secret is NOT created:**
   ```bash
   kubectl get secret kube9-operator-config -n kube9-system
   # Expected: Error: secrets "kube9-operator-config" not found
   ```

6. **Check operator logs for any errors:**
   ```bash
   kubectl logs -n kube9-system deployment/kube9-operator
   # Should see: "Configuration loaded" with tier: "free"
   # Should see: "Secret not found - running in free tier mode"
   ```

7. **Verify NOTES.txt displays correctly:**
   ```bash
   helm get notes kube9-operator -n kube9-system
   # Should show free tier message with upgrade instructions
   ```

### Phase 2: Pro Tier Testing

1. **Upgrade with test API key:**
   ```bash
   helm upgrade kube9-operator charts/kube9-operator \
     --set apiKey=kdy_test_12345 \
     --namespace kube9-system \
     --reuse-values
   ```

2. **Verify Secret is created:**
   ```bash
   kubectl get secret kube9-operator-config -n kube9-system -o yaml
   # Should exist and contain apiKey
   ```

3. **Wait for pod restart and verify operator attempts registration:**
   ```bash
   kubectl wait --for=condition=ready pod \
     -l app.kubernetes.io/name=kube9-operator \
     -n kube9-system \
     --timeout=120s
   
   sleep 10  # Give operator time to attempt registration
   
   kubectl logs -n kube9-system deployment/kube9-operator --tail=50
   # Should see registration attempts (will fail with test key)
   ```

4. **Verify status shows mode="enabled" but registered=false:**
   ```bash
   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq '.'
   
   # Expected values:
   # - mode: "enabled"
   # - tier: "free" (not registered yet)
   # - registered: false
   # - health: "degraded" (API key present but not registered)
   ```

5. **Check error handling is graceful:**
   ```bash
   kubectl get pods -n kube9-system
   # Pod should be running (not crashing)
   
   kubectl get configmap kube9-operator-status -n kube9-system \
     -o jsonpath='{.data.status}' | jq -r '.error'
   # Should show error about registration failure (not null)
   ```

### Phase 3: Helm Commands Testing

1. **Run helm lint:**
   ```bash
   helm lint charts/kube9-operator
   # Should pass with no errors
   ```

2. **Run helm template:**
   ```bash
   # Free tier
   helm template kube9-operator charts/kube9-operator \
     --namespace kube9-system > /tmp/free-tier.yaml
   
   # Pro tier
   helm template kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --set apiKey=kdy_test_12345 > /tmp/pro-tier.yaml
   
   # Verify differences
   diff <(grep -A 5 "kind: Secret" /tmp/free-tier.yaml || echo "No Secret") \
        <(grep -A 5 "kind: Secret" /tmp/pro-tier.yaml)
   # Free tier should have no Secret, pro tier should have Secret
   ```

3. **Test with custom values.yaml:**
   ```bash
   cat > /tmp/test-values.yaml <<EOF
   apiKey: kdy_test_12345
   logLevel: debug
   statusUpdateIntervalSeconds: 30
   EOF
   
   helm template kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     -f /tmp/test-values.yaml
   # Verify custom values are applied
   ```

4. **Test upgrade preserves configuration:**
   ```bash
   # Install with custom values
   helm install kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --create-namespace \
     --set logLevel=debug
   
   # Upgrade with only apiKey
   helm upgrade kube9-operator charts/kube9-operator \
     --namespace kube9-system \
     --set apiKey=kdy_test_12345 \
     --reuse-values
   
   # Verify logLevel is still debug
   kubectl get deployment kube9-operator -n kube9-system \
     -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="LOG_LEVEL")].value}'
   # Expected: "debug"
   ```

5. **Test uninstall removes all resources:**
   ```bash
   helm uninstall kube9-operator --namespace kube9-system
   
   # Verify resources are gone
   kubectl get deployment kube9-operator -n kube9-system
   # Expected: Error: deployments.apps "kube9-operator" not found
   
   kubectl get secret kube9-operator-config -n kube9-system
   # Expected: Error: secrets "kube9-operator-config" not found
   
   kubectl get configmap kube9-operator-status -n kube9-system
   # Expected: Error: configmaps "kube9-operator-status" not found
   ```

### Phase 4: Packaging

1. **Package the chart:**
   ```bash
   helm package charts/kube9-operator
   # Should create: kube9-operator-1.0.0.tgz
   ```

2. **Verify .tgz file is created:**
   ```bash
   ls -lh kube9-operator-*.tgz
   ```

3. **Test installing from package:**
   ```bash
   helm install kube9-operator kube9-operator-1.0.0.tgz \
     --namespace kube9-system \
     --create-namespace
   
   # Verify it works the same as direct install
   kubectl wait --for=condition=ready pod \
     -l app.kubernetes.io/name=kube9-operator \
     -n kube9-system \
     --timeout=120s
   
   helm uninstall kube9-operator --namespace kube9-system
   ```

### Phase 5: Cleanup

1. **Delete Kind cluster:**
   ```bash
   kind delete cluster --name kube9-test
   ```

## Expected Results Summary

### Free Tier (No API Key)
- ✅ Secret: **NOT created**
- ✅ Deployment: **Created** with no API_KEY env var
- ✅ Status ConfigMap: **mode="operated"**, **tier="free"**, **health="healthy"**
- ✅ NOTES.txt: **Shows free tier message** with upgrade instructions

### Pro Tier (With API Key)
- ✅ Secret: **Created** with apiKey
- ✅ Deployment: **Created** with API_KEY env var from Secret
- ✅ Status ConfigMap: **mode="enabled"**, **tier="free"** (until registered), **registered=false**, **health="degraded"**
- ✅ NOTES.txt: **Shows pro tier message**
- ✅ Registration: **Attempts registration** (fails gracefully with test key)

## Troubleshooting

### Operator pod not starting
- Check logs: `kubectl logs -n kube9-system deployment/kube9-operator`
- Verify RBAC: `kubectl get role,rolebinding,clusterrole,clusterrolebinding -n kube9-system`
- Check image: `kubectl describe pod -n kube9-system -l app.kubernetes.io/name=kube9-operator`

### Status ConfigMap not created
- Wait longer (operator updates every 60 seconds by default)
- Check operator logs for errors
- Verify RBAC permissions allow ConfigMap creation

### Registration failing
- Expected with test API key (`kdy_test_12345`)
- Check logs for registration attempts
- Verify SERVER_URL is correct (default: https://api.kube9.dev)

## Completion Checklist

- [ ] Free tier installation works
- [ ] Pro tier installation works
- [ ] helm lint passes with no errors
- [ ] helm template renders correctly
- [ ] Upgrade works correctly
- [ ] Uninstall removes all resources
- [ ] Package created successfully
- [ ] Package install works correctly

