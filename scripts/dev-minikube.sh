#!/bin/bash
# Helper script for local development with minikube
# Ensures minikube is running and provides common commands

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print info
info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if minikube is installed
if ! command -v minikube &> /dev/null; then
    error "minikube is not installed. Please install minikube first."
    echo "  Install: https://minikube.sigs.k8s.io/docs/start/"
    exit 1
fi

info "minikube is installed"

# Check if minikube cluster is running
if ! minikube status &> /dev/null; then
    warning "minikube cluster is not running"
    echo ""
    echo "Starting minikube cluster..."
    minikube start
    info "minikube cluster started"
else
    info "minikube cluster is running"
fi

# Ensure kubectl context is set to minikube
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
if [ "$CURRENT_CONTEXT" != "minikube" ]; then
    info "Setting kubectl context to minikube"
    kubectl config use-context minikube
fi

echo ""
info "Local development environment is ready!"
echo ""
echo "Next steps:"
echo "  1. Run the operator locally: ${GREEN}npm run dev:watch${NC} (for auto-reload)"
echo "     Or: ${GREEN}npm run dev${NC} (single run)"
echo "  2. The operator will connect to minikube via kubeconfig"
echo "  3. Edit code and see changes immediately (with dev:watch)"
echo ""
echo "Note: This script only ensures minikube is running."
echo "      The operator runs separately via npm scripts."
echo ""
echo "Other useful commands:"
echo "  - View operator logs (when running locally): Check the terminal running npm run dev"
echo "  - Check status ConfigMap: ${GREEN}kubectl get configmap kube9-operator-status -n kube9-system -o yaml${NC}"
echo "  - Stop minikube: ${GREEN}minikube stop${NC}"
echo "  - Delete minikube cluster: ${GREEN}minikube delete${NC}"

