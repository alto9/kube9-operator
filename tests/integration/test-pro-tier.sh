#!/bin/bash
# Integration test for pro tier deployment
# Verifies operator works correctly with API key

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../../.." || exit 1

# Source helpers
source "$SCRIPT_DIR/helpers.sh"

# Setup cleanup trap
setup_cleanup_trap

echo "=========================================="
echo "Pro Tier Integration Test"
echo "=========================================="
echo ""

# Check prerequisites
check_prerequisites

# Deploy operator with mock API key
step "Deploying operator with API key (pro tier)"
deploy_operator "$TEST_API_KEY" || exit 1

# Wait for pod to be ready
step "Waiting for operator pod to be ready"
wait_for_pod_ready || exit 1

# Wait for ConfigMap to be created
step "Waiting for status ConfigMap to be created"
wait_for_configmap || exit 1

# Give operator time to attempt registration (will fail gracefully with test key)
sleep 10

# Verify Secret exists
step "Verifying Secret exists"
verify_secret_exists || exit 1

# Verify Secret contains API key
step "Verifying Secret contains API key"
SECRET_VALUE=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.data.apiKey}' | base64 -d 2>/dev/null || echo "")

if [ "$SECRET_VALUE" = "$TEST_API_KEY" ]; then
    success "Secret contains correct API key"
else
    error "Secret API key mismatch. Expected: $TEST_API_KEY, Got: $SECRET_VALUE"
    exit 1
fi

# Verify status shows mode="enabled"
step "Verifying status mode is 'enabled'"
verify_status_field "mode" "enabled" || exit 1

# Verify status shows registered=false (test key will fail registration)
step "Verifying registration status (should be false with test key)"
verify_status_field "registered" "false" || exit 1

# Display full status for debugging
step "Status ConfigMap contents:"
get_status_json | jq '.' || true

# Check operator logs for registration attempt
step "Operator logs (last 20 lines):"
kubectl logs -n "$NAMESPACE" deployment/"$RELEASE_NAME" --tail=20 || true

echo ""
success "Pro tier test passed!"
echo ""

