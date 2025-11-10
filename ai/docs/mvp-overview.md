# kube9-operator MVP Documentation Overview

This document provides an overview of the MVP documentation created for the kube9-operator project.

## Documentation Created

### Actors (3 files)

Actors define who/what interacts with the operator:

1. **kube9-vscode-extension.actor.md** - The VS Code extension that queries operator status
2. **kube9-server.actor.md** - The backend SaaS service for Pro tier features
3. **cluster-administrator.actor.md** - The person who installs and configures the operator

### Features (4 files)

Features define WHAT the operator does from a user perspective:

1. **index.md** - Overall feature group with background and rules
2. **status-exposure.feature.md** - How the operator exposes status to the extension
3. **helm-installation.feature.md** - How the operator is installed via Helm
4. **server-registration.feature.md** - How the operator registers with kube9-server (Pro tier)

### Diagrams (4 files)

Visual representations of architecture and flows:

1. **ecosystem-architecture.diagram.md** - Overall kube9 ecosystem with operator placement
2. **operator-startup-flow.diagram.md** - Operator initialization sequence
3. **status-query-flow.diagram.md** - How the extension queries operator status
4. **tier-modes.diagram.md** - State diagram showing free/pro tier modes

### Specs (3 files)

Technical specifications defining HOW things work:

1. **status-api-spec.spec.md** - ConfigMap-based status API for extension
2. **helm-chart-spec.spec.md** - Complete Helm chart specification
3. **server-api-spec.spec.md** - REST API for operator-server communication

### Models (2 files)

Data structures used by the operator:

1. **operator-status.model.md** - Status data exposed in ConfigMap
2. **registration-data.model.md** - Registration request/response data

### Contexts (2 files)

Implementation guidance and best practices:

1. **kubernetes-operator-development.context.md** - Node.js Kubernetes operator patterns
2. **helm-chart-development.context.md** - Helm chart development best practices

## MVP Scope

### What the MVP Includes

✅ **Status Exposure**
- Operator writes status to ConfigMap every 60 seconds
- Extension reads ConfigMap to determine tier (free vs pro)
- Status includes health, mode, version, registration state

✅ **Helm Installation**
- Simple `helm install` for free tier (no API key)
- `helm install --set apiKey=...` for pro tier
- Standard Helm chart structure with RBAC

✅ **Server Registration**
- Operator registers with kube9-server on startup (if API key provided)
- Validates API key and receives cluster ID
- Re-registers every 24 hours to keep session alive

✅ **Tier Detection**
- **Basic mode**: No operator installed
- **Operated mode**: Operator without API key (free tier)
- **Enabled mode**: Operator with valid API key (pro tier)
- **Degraded mode**: Operator with issues (network, invalid key, etc.)

### What the MVP Does NOT Include

❌ **Metrics Collection** - Future feature
❌ **Data Sanitization** - Future feature (needed when metrics are added)
❌ **Historical Data** - Future feature
❌ **Complex Health Checks** - Basic health only in MVP
❌ **Custom Resource Definitions** - Not needed for MVP
❌ **Operator Lifecycle Manager** - Future enhancement

## Key Architectural Decisions

### 1. ConfigMap for Status
- Simple, Kubernetes-native
- Readable with minimal RBAC permissions
- Updated periodically (every 60 seconds)

### 2. Outbound-Only Communication
- Operator pushes to kube9-server (HTTPS POST)
- No ingress required
- Security-friendly for most clusters

### 3. Two Tier Modes
- **Operated (free)**: Basic functionality, no server communication
- **Enabled (pro)**: Full features with server registration

### 4. Graceful Degradation
- Invalid API key → fall back to free tier
- Server unreachable → continue in degraded mode
- Network issues → retry with exponential backoff

### 5. Node.js 22 Implementation
- Uses @kubernetes/client-node library
- Express for health endpoints
- TypeScript for type safety

## Integration Points

### With kube9-vscode Extension
1. Extension queries ConfigMap `kube9-operator-status` in `kube9-system` namespace
2. Extension parses JSON status data
3. Extension enables/disables features based on tier
4. Extension caches status for 5 minutes

### With kube9-server
1. Operator POSTs to `/v1/operator/register` with API key
2. Server validates key and returns cluster ID + configuration
3. Operator re-registers every 24 hours
4. Operator falls back to free tier if registration fails

### With Helm
1. Chart creates namespace, RBAC, Deployment
2. API key (if provided) stored in Secret
3. Operator reads Secret on startup
4. Chart follows standard Helm conventions

## Security Model

### No Sensitive Data Leakage
- API key stored in Kubernetes Secret (never logged)
- Cluster identifier is non-reversible hash
- No credentials in registration request
- Status ConfigMap contains no secrets

### Minimal Permissions
- ClusterRole: read nodes, namespaces (for future metrics)
- Role: write ConfigMaps in kube9-system only
- Users only need read access to status ConfigMap

### Outbound Only
- No ingress required
- All communication initiated by operator
- HTTPS for all external communication

## Next Steps (Post-MVP)

After MVP is implemented, these features can be added:

1. **Metrics Collection** - Gather sanitized cluster metrics
2. **Metrics Push** - Send metrics to kube9-server
3. **Advanced Health Checks** - Deeper cluster health analysis
4. **Historical Data** - Store metrics over time
5. **Custom Resources** - Consider CRDs for advanced config
6. **Operator Lifecycle Manager** - OLM integration for operator marketplaces

## Getting Started with Implementation

1. **Review Features** - Start with `ai/features/index.md`
2. **Check Architecture** - Review `ai/diagrams/ecosystem-architecture.diagram.md`
3. **Read Specs** - Implementation details in `ai/specs/`
4. **Use Contexts** - Development guidance in `ai/contexts/`
5. **Follow Session** - Track progress in `ai/sessions/mvp/`

## Questions?

For questions about this documentation, refer to:
- Feature files for "what" questions
- Spec files for "how" questions
- Diagram files for "architecture" questions
- Context files for "best practices" questions
- Model files for "data structure" questions

---

**Documentation Version**: 1.0.0  
**Last Updated**: 2025-11-10  
**Session**: mvp  
**Status**: Complete

