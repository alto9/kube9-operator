---
feature_id: helm-installation
spec_id: [helm-chart-spec]
context_id: [helm-chart-development]
---

# Helm Installation Feature

## Overview

The kube9 operator is installed using a Helm chart that supports both free tier (without API key) and pro tier (with API key) deployments.

## Behavior

```gherkin
Feature: Helm Installation

Background:
  Given a cluster administrator has cluster-admin permissions
  And kubectl and helm are installed and configured
  And the cluster is accessible via kubeconfig

Scenario: Install operator in free tier (without API key)
  Given the administrator wants to try kube9 in free tier
  When they run:
    """
    helm repo add kube9 https://charts.kube9.dev
    helm install kube9-operator kube9/kube9-operator \
      --namespace kube9-system \
      --create-namespace
    """
  Then the operator should be deployed to the kube9-system namespace
  And the operator should start in "operated" (free tier) mode
  And the operator should create a status ConfigMap
  And the operator should NOT attempt to connect to kube9-server

Scenario: Install operator in pro tier (with API key)
  Given the administrator has obtained an API key "kdy_prod_abc123" from portal.kube9.dev
  When they run:
    """
    helm install kube9-operator kube9/kube9-operator \
      --set apiKey=kdy_prod_abc123 \
      --namespace kube9-system \
      --create-namespace
    """
  Then the operator should be deployed to the kube9-system namespace
  And the operator should start in "enabled" (pro tier) mode
  And the operator should store the API key in a Kubernetes Secret
  And the operator should register with kube9-server
  And the operator should create a status ConfigMap indicating pro tier

Scenario: Helm chart creates required RBAC resources
  Given the Helm chart is being installed
  When Helm creates resources in the cluster
  Then the chart should create a ServiceAccount for the operator
  And the chart should create a ClusterRole with necessary permissions
  And the chart should create a ClusterRoleBinding linking them
  And the permissions should allow reading cluster metadata (for future metrics)
  And the permissions should allow writing ConfigMaps in kube9-system namespace

Scenario: Helm chart creates operator Deployment
  Given the Helm chart is being installed
  When Helm creates the operator Deployment
  Then the Deployment should be named "kube9-operator"
  And the Deployment should run 1 replica
  And the Deployment should use the operator image from a public registry
  And the Deployment should specify resource requests and limits
  And the Deployment should include liveness and readiness probes

Scenario: Helm chart stores API key securely
  Given the operator is installed with an API key
  When the Helm chart creates resources
  Then the API key should be stored in a Kubernetes Secret
  And the Secret should be named "kube9-operator-config"
  And the Secret should be in the kube9-system namespace
  And the Secret should NOT be printed in logs or status

Scenario: Helm values can customize deployment
  Given a cluster administrator wants to customize the installation
  When they provide a values.yaml file with:
    """yaml
    apiKey: kdy_prod_xyz789
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "200m"
    image:
      tag: "1.0.0"
    """
  Then the Helm chart should apply all customizations
  And the operator should use the specified resource limits
  And the operator should use the specified image tag

Scenario: Upgrade existing installation
  Given the operator is already installed
  And a new version of the Helm chart is available
  When the administrator runs:
    """
    helm upgrade kube9-operator kube9/kube9-operator \
      --namespace kube9-system
    """
  Then the operator should be upgraded to the new version
  And existing configuration (including API key) should be preserved
  And the upgrade should not cause cluster-wide disruption

Scenario: Uninstall operator cleanly
  Given the operator is installed
  When the administrator runs:
    """
    helm uninstall kube9-operator --namespace kube9-system
    """
  Then all operator resources should be removed
  And the kube9-system namespace should be cleaned up (if empty)
  And no residual ClusterRoles or ClusterRoleBindings should remain

Scenario: Helm chart includes helpful documentation
  Given a cluster administrator is reviewing the Helm chart
  When they read the chart README or values.yaml
  Then they should find clear instructions for:
    - Free tier installation
    - Pro tier installation with API key
    - Customization options
    - Resource requirements
    - Troubleshooting common issues
```

## Helm Chart Structure

```
kube9-operator/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default configuration values
├── README.md          # Installation and usage documentation
└── templates/
    ├── deployment.yaml       # Operator Deployment
    ├── serviceaccount.yaml   # ServiceAccount for operator
    ├── clusterrole.yaml      # ClusterRole with permissions
    ├── clusterrolebinding.yaml # ClusterRoleBinding
    ├── secret.yaml           # Secret for API key (if provided)
    └── configmap.yaml        # ConfigMap for configuration
```

## Integration Points

- **Public Helm Repository**: Charts hosted at charts.kube9.dev
- **Container Registry**: Operator images in public registry
- **kube9-server**: API key validation during pro tier installation
- **portal.kube9.dev**: Where users obtain API keys

## Non-Goals

- Custom Resource Definitions (not needed for MVP)
- Operator Lifecycle Manager (OLM) integration (future enhancement)
- Private registry support (future enhancement)

