#!/bin/bash
# Integration test for free tier deployment
# Verifies operator works correctly without API key

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../../.." || exit 1

# Source helpers
source "$SCRIPT_DIR/helpers.sh"

# Setup cleanup trap
setup_cleanup_trap

echo "=========================================="
echo "Free Tier Integration Test"
echo "=========================================="
echo ""

# Check prerequisites
check_prerequisites

# Deploy operator without API key
step "Deploying operator without API key (free tier)"
deploy_operator "" || exit 1

# Wait for pod to be ready
step "Waiting for operator pod to be ready"
wait_for_pod_ready || exit 1

# Wait for ConfigMap to be created
step "Waiting for status ConfigMap to be created"
wait_for_configmap || exit 1

# Give operator a moment to write initial status
sleep 5

# Verify status shows mode="operated"
step "Verifying status mode is 'operated'"
verify_status_field "mode" "operated" || exit 1

# Verify status shows tier="free"
step "Verifying status tier is 'free'"
verify_status_field "tier" "free" || exit 1

# Verify Secret does NOT exist
step "Verifying Secret does NOT exist"
verify_secret_not_exists || exit 1

# Display full status for debugging
step "Status ConfigMap contents:"
get_status_json | jq '.' || true

echo ""
success "Free tier test passed!"
echo ""

