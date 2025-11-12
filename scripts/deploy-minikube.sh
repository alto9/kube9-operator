#!/bin/bash
# Deploy kube9-operator to minikube cluster for in-cluster testing
# Builds Docker image, loads into minikube, and deploys with Helm

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="kube9-operator"
IMAGE_TAG="local"
NAMESPACE="kube9-system"
RELEASE_NAME="kube9-operator"
CHART_DIR="charts/kube9-operator"

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

echo "=========================================="
echo "Deploying kube9-operator to minikube"
echo "=========================================="
echo ""

# Check prerequisites
info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    error "docker is not installed"
    exit 1
fi
success "docker is installed"

if ! command -v minikube &> /dev/null; then
    error "minikube is not installed"
    exit 1
fi
success "minikube is installed"

if ! command -v helm &> /dev/null; then
    error "helm is not installed"
    exit 1
fi
success "helm is installed"

if ! command -v kubectl &> /dev/null; then
    error "kubectl is not installed"
    exit 1
fi
success "kubectl is installed"

# Check if minikube is running
if ! minikube status &> /dev/null; then
    error "minikube cluster is not running"
    echo "  Start minikube: minikube start"
    exit 1
fi
success "minikube cluster is running"

echo ""

# Step 1: Build Docker image
info "Step 1: Building Docker image..."
if docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .; then
    success "Docker image built: ${IMAGE_NAME}:${IMAGE_TAG}"
else
    error "Docker build failed"
    exit 1
fi

echo ""

# Step 2: Load image into minikube
info "Step 2: Loading image into minikube..."
if minikube image load "${IMAGE_NAME}:${IMAGE_TAG}"; then
    success "Image loaded into minikube"
else
    error "Failed to load image into minikube"
    exit 1
fi

echo ""

# Step 3: Create namespace if it doesn't exist
info "Step 3: Ensuring namespace exists..."
if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    info "Namespace ${NAMESPACE} already exists"
else
    if kubectl create namespace "${NAMESPACE}"; then
        success "Namespace ${NAMESPACE} created"
    else
        error "Failed to create namespace"
        exit 1
    fi
fi

echo ""

# Step 4: Deploy with Helm
info "Step 4: Deploying with Helm..."

# Check if release already exists
if helm list -n "${NAMESPACE}" | grep -q "^${RELEASE_NAME}"; then
    warning "Release ${RELEASE_NAME} already exists, upgrading..."
    if helm upgrade "${RELEASE_NAME}" "${CHART_DIR}" \
        --namespace "${NAMESPACE}" \
        --set "image.repository=${IMAGE_NAME}" \
        --set "image.tag=${IMAGE_TAG}" \
        --set "image.pullPolicy=Never"; then
        success "Helm upgrade completed"
    else
        error "Helm upgrade failed"
        exit 1
    fi
else
    if helm install "${RELEASE_NAME}" "${CHART_DIR}" \
        --namespace "${NAMESPACE}" \
        --create-namespace \
        --set "image.repository=${IMAGE_NAME}" \
        --set "image.tag=${IMAGE_TAG}" \
        --set "image.pullPolicy=Never"; then
        success "Helm install completed"
    else
        error "Helm install failed"
        exit 1
    fi
fi

echo ""

# Step 5: Wait for deployment
info "Step 5: Waiting for operator pod to be ready..."
if kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/name=kube9-operator \
    -n "${NAMESPACE}" \
    --timeout=120s; then
    success "Operator pod is ready"
else
    warning "Operator pod not ready within timeout"
    echo "  Check pod status: kubectl get pods -n ${NAMESPACE}"
    echo "  View logs: kubectl logs -n ${NAMESPACE} deployment/${RELEASE_NAME}"
fi

echo ""

# Step 6: Verify deployment
info "Step 6: Verifying deployment..."

# Check pod status
POD_STATUS=$(kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/name=kube9-operator -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Unknown")
if [ "$POD_STATUS" = "Running" ]; then
    success "Pod is running"
else
    warning "Pod status: ${POD_STATUS}"
fi

# Wait a moment for operator to initialize
sleep 5

# Check if status ConfigMap exists
if kubectl get configmap kube9-operator-status -n "${NAMESPACE}" &> /dev/null; then
    success "Status ConfigMap exists"
    info "Status ConfigMap content:"
    if command -v jq &> /dev/null; then
        kubectl get configmap kube9-operator-status -n "${NAMESPACE}" -o jsonpath='{.data.status}' | jq . 2>/dev/null || kubectl get configmap kube9-operator-status -n "${NAMESPACE}" -o yaml
    else
        kubectl get configmap kube9-operator-status -n "${NAMESPACE}" -o yaml
    fi
else
    warning "Status ConfigMap not found yet (operator may still be initializing)"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  View logs: ${GREEN}kubectl logs -n ${NAMESPACE} deployment/${RELEASE_NAME}${NC}"
echo "  Check status: ${GREEN}kubectl get configmap kube9-operator-status -n ${NAMESPACE} -o yaml${NC}"
echo "  Uninstall: ${GREEN}npm run clean:minikube${NC} or ${GREEN}helm uninstall ${RELEASE_NAME} --namespace ${NAMESPACE}${NC}"
echo ""

