#!/bin/bash
# Integration test for status update frequency
# Verifies operator updates ConfigMap every ~60 seconds

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../../.." || exit 1

# Source helpers
source "$SCRIPT_DIR/helpers.sh"

# Setup cleanup trap
setup_cleanup_trap

echo "=========================================="
echo "Status Updates Integration Test"
echo "=========================================="
echo ""

# Check prerequisites
check_prerequisites

# Deploy operator (free tier for simplicity)
step "Deploying operator (free tier)"
deploy_operator "" || exit 1

# Wait for pod to be ready
step "Waiting for operator pod to be ready"
wait_for_pod_ready || exit 1

# Wait for ConfigMap to be created
step "Waiting for status ConfigMap to be created"
wait_for_configmap || exit 1

# Give operator time to write initial status
sleep 5

# Capture initial timestamp
step "Capturing initial status timestamp"
INITIAL_TIMESTAMP=$(get_configmap_timestamp)

if [ -z "$INITIAL_TIMESTAMP" ] || [ "$INITIAL_TIMESTAMP" = "null" ]; then
    error "Failed to get initial timestamp"
    exit 1
fi

info "Initial timestamp: $INITIAL_TIMESTAMP"

# Watch ConfigMap for 3 minutes (180 seconds)
# We expect updates every ~60 seconds, so we should see at least 2-3 updates
step "Watching ConfigMap for 3 minutes to verify periodic updates"
info "This will take approximately 3 minutes..."

UPDATE_COUNT=0
WATCH_DURATION=180  # 3 minutes
CHECK_INTERVAL=10   # Check every 10 seconds
ELAPSED=0
LAST_TIMESTAMP="$INITIAL_TIMESTAMP"

while [ $ELAPSED -lt $WATCH_DURATION ]; do
    sleep $CHECK_INTERVAL
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
    
    CURRENT_TIMESTAMP=$(get_configmap_timestamp)
    
    if [ "$CURRENT_TIMESTAMP" != "$LAST_TIMESTAMP" ] && [ -n "$CURRENT_TIMESTAMP" ] && [ "$CURRENT_TIMESTAMP" != "null" ]; then
        UPDATE_COUNT=$((UPDATE_COUNT + 1))
        info "Update #$UPDATE_COUNT detected at ${ELAPSED}s (timestamp: $CURRENT_TIMESTAMP)"
        LAST_TIMESTAMP="$CURRENT_TIMESTAMP"
    fi
    
    # Show progress every 30 seconds
    if [ $((ELAPSED % 30)) -eq 0 ]; then
        info "Progress: ${ELAPSED}s / ${WATCH_DURATION}s (updates detected: $UPDATE_COUNT)"
    fi
done

# Verify we saw at least 2 updates (should be 2-3 in 3 minutes with 60s interval)
step "Verifying update frequency"
if [ $UPDATE_COUNT -ge 2 ]; then
    success "Detected $UPDATE_COUNT updates over 3 minutes (expected 2-3)"
    
    # Calculate approximate interval
    if [ $UPDATE_COUNT -gt 0 ]; then
        APPROX_INTERVAL=$((WATCH_DURATION / UPDATE_COUNT))
        info "Approximate update interval: ~${APPROX_INTERVAL}s (expected ~60s)"
        
        # Verify interval is reasonable (between 45-75 seconds)
        if [ $APPROX_INTERVAL -ge 45 ] && [ $APPROX_INTERVAL -le 75 ]; then
            success "Update interval is within expected range"
        else
            warning "Update interval (${APPROX_INTERVAL}s) is outside expected range (45-75s)"
        fi
    fi
else
    error "Only detected $UPDATE_COUNT updates over 3 minutes (expected at least 2)"
    exit 1
fi

# Display final status
step "Final status ConfigMap contents:"
get_status_json | jq '.' || true

echo ""
success "Status updates test passed!"
echo ""

