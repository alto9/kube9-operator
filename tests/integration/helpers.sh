#!/bin/bash
# Shared helper functions for kube9-operator integration tests

# Constants
NAMESPACE="kube9-system"
RELEASE_NAME="kube9-operator"
CONFIGMAP_NAME="kube9-operator-status"
SECRET_NAME="kube9-operator-config"
CHART_DIR="charts/kube9-operator"
TEST_API_KEY="kdy_test_12345"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print info
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to print test step
step() {
    echo -e "\n${BLUE}→${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    local missing_tools=()
    
    if ! command -v helm &> /dev/null; then
        missing_tools+=("helm")
    fi
    
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        echo "Please install the missing tools and try again."
        exit 1
    fi
    
    success "All prerequisites met"
}

# Wait for pod to be ready
wait_for_pod_ready() {
    local namespace="${1:-$NAMESPACE}"
    local release_name="${2:-$RELEASE_NAME}"
    local timeout="${3:-120}"
    
    info "Waiting for pod to be ready (timeout: ${timeout}s)..."
    
    if kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=kube9-operator \
        -n "$namespace" \
        --timeout="${timeout}s" &>/dev/null; then
        success "Pod is ready"
        return 0
    else
        error "Pod failed to become ready within ${timeout}s"
        return 1
    fi
}

# Wait for ConfigMap to exist
wait_for_configmap() {
    local namespace="${1:-$NAMESPACE}"
    local configmap_name="${2:-$CONFIGMAP_NAME}"
    local timeout="${3:-60}"
    local elapsed=0
    
    info "Waiting for ConfigMap $configmap_name to exist (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        if kubectl get configmap "$configmap_name" -n "$namespace" &>/dev/null; then
            success "ConfigMap $configmap_name exists"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    error "ConfigMap $configmap_name not found within ${timeout}s"
    return 1
}

# Get a field from the status ConfigMap JSON
get_status_field() {
    local field="$1"
    local namespace="${2:-$NAMESPACE}"
    local configmap_name="${3:-$CONFIGMAP_NAME}"
    
    kubectl get configmap "$configmap_name" -n "$namespace" \
        -o jsonpath='{.data.status}' 2>/dev/null | jq -r ".$field" 2>/dev/null
}

# Get the full status JSON
get_status_json() {
    local namespace="${1:-$NAMESPACE}"
    local configmap_name="${2:-$CONFIGMAP_NAME}"
    
    kubectl get configmap "$configmap_name" -n "$namespace" \
        -o jsonpath='{.data.status}' 2>/dev/null
}

# Verify status field matches expected value
verify_status_field() {
    local field="$1"
    local expected="$2"
    local namespace="${3:-$NAMESPACE}"
    local configmap_name="${4:-$CONFIGMAP_NAME}"
    
    local actual=$(get_status_field "$field" "$namespace" "$configmap_name")
    
    if [ "$actual" = "$expected" ]; then
        success "Status field $field is correct: $actual"
        return 0
    else
        error "Status field $field mismatch. Expected: $expected, Got: $actual"
        return 1
    fi
}

# Cleanup function - uninstall Helm release
cleanup() {
    local namespace="${1:-$NAMESPACE}"
    local release_name="${2:-$RELEASE_NAME}"
    
    info "Cleaning up Helm release $release_name..."
    
    if helm list -n "$namespace" | grep -q "^$release_name\s"; then
        helm uninstall "$release_name" --namespace "$namespace" &>/dev/null || true
        success "Helm release uninstalled"
    else
        info "Helm release $release_name not found, skipping cleanup"
    fi
}

# Setup trap for cleanup on exit
setup_cleanup_trap() {
    trap 'cleanup' EXIT INT TERM
}

# Deploy operator using Helm
deploy_operator() {
    local api_key="${1:-}"
    local namespace="${2:-$NAMESPACE}"
    local release_name="${3:-$RELEASE_NAME}"
    local chart_dir="${4:-$CHART_DIR}"
    
    local helm_args=(
        "install" "$release_name" "$chart_dir"
        "--namespace" "$namespace"
        "--create-namespace"
        "--wait"
        "--timeout" "5m"
    )
    
    if [ -n "$api_key" ]; then
        helm_args+=("--set" "apiKey=$api_key")
    else
        helm_args+=("--set" "apiKey=")
    fi
    
    info "Deploying operator (tier: ${api_key:+pro}${api_key:-free})..."
    
    if helm "${helm_args[@]}" &>/dev/null; then
        success "Operator deployed successfully"
        return 0
    else
        error "Failed to deploy operator"
        return 1
    fi
}

# Verify Secret exists
verify_secret_exists() {
    local namespace="${1:-$NAMESPACE}"
    local secret_name="${2:-$SECRET_NAME}"
    
    if kubectl get secret "$secret_name" -n "$namespace" &>/dev/null; then
        success "Secret $secret_name exists"
        return 0
    else
        error "Secret $secret_name not found"
        return 1
    fi
}

# Verify Secret does NOT exist
verify_secret_not_exists() {
    local namespace="${1:-$NAMESPACE}"
    local secret_name="${2:-$SECRET_NAME}"
    
    if kubectl get secret "$secret_name" -n "$namespace" &>/dev/null; then
        error "Secret $secret_name should NOT exist"
        return 1
    else
        success "Secret $secret_name correctly does NOT exist"
        return 0
    fi
}

# Get ConfigMap timestamp
get_configmap_timestamp() {
    local namespace="${1:-$NAMESPACE}"
    local configmap_name="${2:-$CONFIGMAP_NAME}"
    
    get_status_field "lastUpdate" "$namespace" "$configmap_name"
}

# Wait for ConfigMap update (timestamp changes)
wait_for_configmap_update() {
    local initial_timestamp="$1"
    local namespace="${2:-$NAMESPACE}"
    local configmap_name="${3:-$CONFIGMAP_NAME}"
    local timeout="${4:-70}"
    local elapsed=0
    
    info "Waiting for ConfigMap update (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        local current_timestamp=$(get_configmap_timestamp "$namespace" "$configmap_name")
        
        if [ "$current_timestamp" != "$initial_timestamp" ] && [ -n "$current_timestamp" ]; then
            success "ConfigMap updated (timestamp changed)"
            return 0
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    error "ConfigMap did not update within ${timeout}s"
    return 1
}

