#!/bin/bash
# Helm Chart Testing Script
# This script tests the kube9-operator Helm chart (default install; no Helm apiKey surface)

set -e

CHART_DIR="charts/kube9-operator"
RELEASE_NAME="kube9-operator"
NAMESPACE="kube9-system"
KIND_CLUSTER="kube9-test"

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

echo "Testing default install (no API key Secret, no API_KEY env)..."
TEMPLATE_OUTPUT=$(helm template "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE")

if echo "$TEMPLATE_OUTPUT" | grep -q "kind: Secret"; then
    error "Chart must not render a Secret for API keys"
    exit 1
else
    success "No Secret rendered for default install"
fi

if echo "$TEMPLATE_OUTPUT" | grep -q "API_KEY"; then
    error "API_KEY env var must not appear in rendered manifests"
    exit 1
else
    success "API_KEY env var correctly absent"
fi

if echo "$TEMPLATE_OUTPUT" | grep -q "kind: Deployment"; then
    success "Deployment template renders correctly"
else
    error "Deployment template failed to render"
    exit 1
fi

echo ""

# Phase 3: NOTES.txt Validation
echo "Phase 3: NOTES.txt Validation"
echo "------------------------------"

info "NOTES.txt output is validated on helm install (helm get notes)"
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
    echo "Testing Default Install..."
    echo "----------------------------------"
    
    helm install "$RELEASE_NAME" "$CHART_DIR" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --wait \
        --timeout 5m
    
    success "Default install completed"
    
    # Verify operator pod
    echo "Waiting for operator pod to be ready..."
    kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=kube9-operator \
        -n "$NAMESPACE" \
        --timeout=120s
    success "Operator pod is ready"
    
    # Verify Secret is NOT created
    if kubectl get secret "${RELEASE_NAME}-config" -n "$NAMESPACE" &>/dev/null; then
        error "Secret should NOT exist for default install"
        exit 1
    else
        success "Secret correctly does NOT exist for default install"
    fi
    
    # Verify status ConfigMap
    echo "Checking status ConfigMap..."
    sleep 10  # Give operator time to create ConfigMap
    
    if kubectl get configmap kube9-operator-status -n "$NAMESPACE" &>/dev/null; then
        success "Status ConfigMap exists"
        
        STATUS_MODE=$(kubectl get configmap kube9-operator-status -n "$NAMESPACE" -o jsonpath='{.data.status}' | jq -r '.mode' 2>/dev/null || echo "")
        
        if [ "$STATUS_MODE" = "operated" ]; then
            success "Status mode is correct: $STATUS_MODE"
        else
            error "Status mode incorrect. Expected: operated, Got: $STATUS_MODE"
        fi
    else
        warning "Status ConfigMap not found yet (may need more time)"
    fi
    
    # Check operator logs
    echo ""
    echo "Operator logs (last 20 lines):"
    kubectl logs -n "$NAMESPACE" deployment/"$RELEASE_NAME" --tail=20 || true
    
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
echo "  ✓ Template rendering validated (default install)"
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

