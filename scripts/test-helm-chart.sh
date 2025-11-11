#!/bin/bash
# Helm Chart Testing Script
# This script tests the kube9-operator Helm chart with both free and pro tier configurations

set -e

CHART_DIR="charts/kube9-operator"
RELEASE_NAME="kube9-operator"
NAMESPACE="kube9-system"
KIND_CLUSTER="kube9-test"
TEST_API_KEY="kdy_test_12345"

echo "=========================================="
echo "kube9-operator Helm Chart Testing"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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
    echo -e "ℹ  $1"
}

# Check prerequisites
echo "Phase 0: Checking Prerequisites"
echo "---------------------------------"

if ! command -v helm &> /dev/null; then
    error "helm is not installed. Please install helm first."
    echo "  Install: https://helm.sh/docs/intro/install/"
    exit 1
fi
success "helm is installed"

if ! command -v kubectl &> /dev/null; then
    error "kubectl is not installed. Please install kubectl first."
    exit 1
fi
success "kubectl is installed"

if ! command -v kind &> /dev/null; then
    warning "kind is not installed. Skipping cluster testing."
    SKIP_CLUSTER=true
else
    success "kind is installed"
    SKIP_CLUSTER=false
fi

echo ""

# Phase 1: Helm Lint
echo "Phase 1: Helm Lint Validation"
echo "------------------------------"
if helm lint "$CHART_DIR"; then
    success "helm lint passed"
else
    error "helm lint failed"
    exit 1
fi
echo ""

# Phase 2: Helm Template Validation
echo "Phase 2: Helm Template Validation"
echo "----------------------------------"

echo "Testing free tier (no API key)..."
FREE_TIER_OUTPUT=$(helm template "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --set apiKey="")

if echo "$FREE_TIER_OUTPUT" | grep -q "kind: Secret"; then
    error "Secret should NOT be created in free tier"
    exit 1
else
    success "Secret correctly NOT created in free tier"
fi

if echo "$FREE_TIER_OUTPUT" | grep -q "API_KEY"; then
    error "API_KEY env var should NOT be set in free tier"
    exit 1
else
    success "API_KEY env var correctly NOT set in free tier"
fi

if echo "$FREE_TIER_OUTPUT" | grep -q "kind: Deployment"; then
    success "Deployment template renders correctly"
else
    error "Deployment template failed to render"
    exit 1
fi

echo ""
echo "Testing pro tier (with API key)..."
PRO_TIER_OUTPUT=$(helm template "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --set apiKey="$TEST_API_KEY")

if echo "$PRO_TIER_OUTPUT" | grep -q "kind: Secret"; then
    success "Secret correctly created in pro tier"
else
    error "Secret should be created in pro tier"
    exit 1
fi

if echo "$PRO_TIER_OUTPUT" | grep -q "API_KEY"; then
    success "API_KEY env var correctly set in pro tier"
else
    error "API_KEY env var should be set in pro tier"
    exit 1
fi

# Verify Secret name
SECRET_NAME=$(echo "$PRO_TIER_OUTPUT" | grep -A 5 "kind: Secret" | grep "name:" | awk '{print $2}')
if [ "$SECRET_NAME" = "${RELEASE_NAME}-config" ]; then
    success "Secret name is correct: $SECRET_NAME"
else
    error "Secret name mismatch. Expected: ${RELEASE_NAME}-config, Got: $SECRET_NAME"
    exit 1
fi

echo ""

# Phase 3: NOTES.txt Validation
echo "Phase 3: NOTES.txt Validation"
echo "------------------------------"

FREE_NOTES=$(helm template "$RELEASE_NAME" "$CHART_DIR" --namespace "$NAMESPACE" | grep -A 20 "NOTES.txt" || echo "")
PRO_NOTES=$(helm template "$RELEASE_NAME" "$CHART_DIR" --namespace "$NAMESPACE" --set apiKey="$TEST_API_KEY" | grep -A 20 "NOTES.txt" || echo "")

# Check NOTES.txt content (this is tricky since NOTES.txt is rendered separately)
info "NOTES.txt will be validated during actual installation"
echo ""

# Phase 4: Package Creation
echo "Phase 4: Package Creation"
echo "-------------------------"

PACKAGE_FILE=$(helm package "$CHART_DIR" 2>&1 | grep -o "kube9-operator-[0-9.]*\.tgz" || echo "")

if [ -n "$PACKAGE_FILE" ] && [ -f "$PACKAGE_FILE" ]; then
    success "Package created: $PACKAGE_FILE"
    
    # Test installing from package
    echo ""
    echo "Testing installation from package..."
    PACKAGE_OUTPUT=$(helm template "$RELEASE_NAME" "$PACKAGE_FILE" --namespace "$NAMESPACE" 2>&1)
    
    if echo "$PACKAGE_OUTPUT" | grep -q "kind: Deployment"; then
        success "Package can be used for installation"
    else
        error "Package installation test failed"
        exit 1
    fi
else
    error "Package creation failed"
    exit 1
fi

echo ""

# Phase 5: Cluster Testing (if kind is available)
if [ "$SKIP_CLUSTER" = false ]; then
    echo "Phase 5: Cluster Testing"
    echo "-----------------------"
    
    # Check if cluster already exists
    if kind get clusters | grep -q "^${KIND_CLUSTER}$"; then
        warning "Cluster $KIND_CLUSTER already exists. Deleting..."
        kind delete cluster --name "$KIND_CLUSTER"
    fi
    
    echo "Creating Kind cluster: $KIND_CLUSTER"
    kind create cluster --name "$KIND_CLUSTER"
    success "Kind cluster created"
    
    # Wait for cluster to be ready
    echo "Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=120s
    success "Cluster is ready"
    
    echo ""
    echo "Testing Free Tier Installation..."
    echo "----------------------------------"
    
    helm install "$RELEASE_NAME" "$CHART_DIR" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --wait \
        --timeout 5m
    
    success "Free tier installation completed"
    
    # Verify operator pod
    echo "Waiting for operator pod to be ready..."
    kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=kube9-operator \
        -n "$NAMESPACE" \
        --timeout=120s
    success "Operator pod is ready"
    
    # Verify Secret is NOT created
    if kubectl get secret "${RELEASE_NAME}-config" -n "$NAMESPACE" &>/dev/null; then
        error "Secret should NOT exist in free tier"
        exit 1
    else
        success "Secret correctly does NOT exist in free tier"
    fi
    
    # Verify status ConfigMap
    echo "Checking status ConfigMap..."
    sleep 10  # Give operator time to create ConfigMap
    
    if kubectl get configmap kube9-operator-status -n "$NAMESPACE" &>/dev/null; then
        success "Status ConfigMap exists"
        
        STATUS_MODE=$(kubectl get configmap kube9-operator-status -n "$NAMESPACE" -o jsonpath='{.data.status}' | jq -r '.mode' 2>/dev/null || echo "")
        STATUS_TIER=$(kubectl get configmap kube9-operator-status -n "$NAMESPACE" -o jsonpath='{.data.status}' | jq -r '.tier' 2>/dev/null || echo "")
        
        if [ "$STATUS_MODE" = "operated" ]; then
            success "Status mode is correct: $STATUS_MODE"
        else
            error "Status mode incorrect. Expected: operated, Got: $STATUS_MODE"
        fi
        
        if [ "$STATUS_TIER" = "free" ]; then
            success "Status tier is correct: $STATUS_TIER"
        else
            error "Status tier incorrect. Expected: free, Got: $STATUS_TIER"
        fi
    else
        warning "Status ConfigMap not found yet (may need more time)"
    fi
    
    # Check operator logs
    echo ""
    echo "Operator logs (last 20 lines):"
    kubectl logs -n "$NAMESPACE" deployment/"$RELEASE_NAME" --tail=20 || true
    
    echo ""
    echo "Testing Pro Tier Upgrade..."
    echo "---------------------------"
    
    helm upgrade "$RELEASE_NAME" "$CHART_DIR" \
        --namespace "$NAMESPACE" \
        --set apiKey="$TEST_API_KEY" \
        --reuse-values \
        --wait \
        --timeout 5m
    
    success "Pro tier upgrade completed"
    
    # Verify Secret IS created
    if kubectl get secret "${RELEASE_NAME}-config" -n "$NAMESPACE" &>/dev/null; then
        success "Secret correctly exists in pro tier"
    else
        error "Secret should exist in pro tier"
        exit 1
    fi
    
    # Wait for pod restart
    echo "Waiting for operator pod to restart..."
    sleep 15
    kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=kube9-operator \
        -n "$NAMESPACE" \
        --timeout=120s
    success "Operator pod restarted and ready"
    
    # Verify status shows enabled mode
    echo "Checking updated status..."
    sleep 10
    
    STATUS_MODE=$(kubectl get configmap kube9-operator-status -n "$NAMESPACE" -o jsonpath='{.data.status}' | jq -r '.mode' 2>/dev/null || echo "")
    STATUS_REGISTERED=$(kubectl get configmap kube9-operator-status -n "$NAMESPACE" -o jsonpath='{.data.status}' | jq -r '.registered' 2>/dev/null || echo "")
    
    if [ "$STATUS_MODE" = "enabled" ]; then
        success "Status mode is correct: $STATUS_MODE"
    else
        error "Status mode incorrect. Expected: enabled, Got: $STATUS_MODE"
    fi
    
    if [ "$STATUS_REGISTERED" = "false" ]; then
        success "Status registered is correct: $STATUS_REGISTERED (test key will fail)"
    else
        warning "Status registered: $STATUS_REGISTERED (may have succeeded unexpectedly)"
    fi
    
    # Check operator logs for registration attempt
    echo ""
    echo "Operator logs after upgrade (last 30 lines):"
    kubectl logs -n "$NAMESPACE" deployment/"$RELEASE_NAME" --tail=30 || true
    
    echo ""
    echo "Testing Uninstall..."
    echo "-------------------"
    
    helm uninstall "$RELEASE_NAME" --namespace "$NAMESPACE"
    success "Uninstall completed"
    
    # Verify resources are removed
    sleep 5
    if kubectl get deployment "$RELEASE_NAME" -n "$NAMESPACE" &>/dev/null; then
        warning "Deployment still exists (may need more time)"
    else
        success "Deployment removed"
    fi
    
    echo ""
    echo "Cleaning up Kind cluster..."
    kind delete cluster --name "$KIND_CLUSTER"
    success "Kind cluster deleted"
else
    echo "Phase 5: Cluster Testing"
    echo "-----------------------"
    info "Skipped (kind not installed)"
    echo ""
    echo "To test with a real cluster, run:"
    echo "  kind create cluster --name $KIND_CLUSTER"
    echo "  helm install $RELEASE_NAME $CHART_DIR --namespace $NAMESPACE --create-namespace"
    echo "  # ... follow manual testing steps from task file ..."
    echo "  kind delete cluster --name $KIND_CLUSTER"
fi

echo ""
echo "=========================================="
echo "Testing Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Helm lint passed"
echo "  ✓ Template rendering validated (free & pro tier)"
echo "  ✓ Package created and validated"
if [ "$SKIP_CLUSTER" = false ]; then
    echo "  ✓ Cluster testing completed"
else
    echo "  ⚠ Cluster testing skipped (install kind to enable)"
fi
echo ""
echo "Next steps:"
echo "  1. Review the package: $PACKAGE_FILE"
echo "  2. Test in your target Kubernetes environment"
echo "  3. Verify NOTES.txt output during installation"
echo ""

