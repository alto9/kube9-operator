---
actor_id: cluster-administrator
type: user
---

# Cluster Administrator

## Overview

The Cluster Administrator is responsible for installing and configuring the kube9 operator in their Kubernetes cluster using Helm.

## Responsibilities

- Install kube9-operator via Helm chart
- Configure API key for Pro tier (optional)
- Grant operator appropriate RBAC permissions
- Monitor operator health and status
- Upgrade operator to new versions
- Troubleshoot operator issues

## Characteristics

- **Technical Level**: Experienced with Kubernetes and Helm
- **Access**: Has cluster-admin or equivalent permissions
- **Tools**: kubectl, helm, and cluster access
- **Context**: Managing development or production Kubernetes clusters

## Usage Patterns

### Free Tier Installation

```bash
helm repo add kube9 https://charts.kube9.dev
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

### Pro Tier Installation

```bash
# Get API key from portal.kube9.dev first
helm repo add kube9 https://charts.kube9.dev
helm install kube9-operator kube9/kube9-operator \
  --set apiKey=kdy_prod_abc123def456 \
  --namespace kube9-system \
  --create-namespace
```

### Checking Status

```bash
kubectl get pods -n kube9-system
kubectl logs -n kube9-system deployment/kube9-operator
```

### Upgrading

```bash
helm repo update
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system
```

## Expectations

- Installation should be simple and follow Helm best practices
- Operator should clearly log its status (free vs pro tier)
- Operator should not require ingress or external access
- Operator should respect cluster RBAC and security policies
- Operator should have minimal resource footprint
- Operator should provide clear error messages for misconfiguration

## Pain Points

- Wants to avoid complex networking setup
- Concerned about security and data leakage
- Needs to understand resource requirements
- Wants to verify operator is working correctly
- May have air-gapped or restricted cluster environments

