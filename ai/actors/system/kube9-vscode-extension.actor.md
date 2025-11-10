---
actor_id: kube9-vscode-extension
type: system
---

# kube9 VS Code Extension

## Overview

The kube9 VS Code Extension is the primary consumer of operator status information. It uses the operator to determine cluster tier status and enable/disable features accordingly.

## Responsibilities

- Detect operator presence in connected Kubernetes clusters
- Query operator status to determine tier (free/operated vs pro/enabled)
- Enable/disable UI features based on operator status
- Display appropriate upgrade prompts to free tier users
- Communicate with kube9-server when API key is configured

## Characteristics

- **Platform**: VS Code Extension (Node.js 22)
- **Communication**: kubectl commands and Kubernetes API
- **Access**: Uses user's kubeconfig for cluster authentication
- **Deployment**: Installed per-developer from VS Code Marketplace

## Interaction with Operator

### Tier Detection Flow

1. Extension connects to cluster via kubeconfig
2. Extension checks for operator presence (kube9-operator deployment in kube9-system namespace)
3. If operator exists, extension queries status endpoint
4. Extension determines tier based on operator response:
   - **Free Tier (Operated)**: Operator installed without API key
   - **Pro Tier (Enabled)**: Operator installed with valid API key
   - **No Operator**: Basic kubectl-only mode

### Feature Enablement

**Free Tier (Operated)**:
- Local HTML webviews with basic resource views
- Simple CRUD operations
- No AI features
- Shows upgrade prompts for Pro features

**Pro Tier (Enabled)**:
- Rich web UIs loaded from kube9-server via iframes
- AI-powered recommendations
- Advanced dashboards with charts
- Historical metrics and trends
- Log aggregation

**No Operator**:
- Most minimal feature set
- Read-only kubectl operations
- No dashboards or advanced features
- Shows installation prompts

## Technical Requirements

- Must handle operator not being installed gracefully
- Must not fail if operator is unreachable
- Must cache operator status to avoid excessive queries
- Must respect cluster RBAC permissions when checking operator status

