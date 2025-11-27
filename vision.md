# kube9 Operator - Vision

## Mission

kube9-operator is the core component of the kube9 open source toolkit, providing Kubernetes Well-Architected Framework validation and cluster insights. The operator runs in clusters, performing scheduled framework assessments and enabling integration with the kube9 VS Code extension and optional Helm-based UI components through secure, outbound communication.

## Core Purpose

**Why kube9-operator exists**: Kubernetes clusters need continuous Well-Architected Framework validation and intelligent cluster management. The operator performs framework checks on a schedule, generating point-in-time reports in free tier mode and establishing scheduled data reporting to kube9-server when an API key is configured. It serves as the foundation for the kube9 ecosystem, enabling VS Code extension and UI components to provide cluster management capabilities while maintaining strict security boundaries and minimal resource footprint.

## Long-Term Vision

### The Operator We're Building

kube9-operator will become the **standard way for clusters to participate in the kube9 ecosystem**, providing:

1. **Well-Architected Framework Validation**: Scheduled assessment across all 6 framework pillars
2. **Zero-Trust Security**: No ingress required, all communication is outbound
3. **Tier Detection**: Enables VS Code extension and UI components to adapt features based on cluster capabilities
4. **Health Monitoring**: Continuous cluster health assessment and status reporting
5. **Pro Tier Gateway**: Secure bridge to kube9-server for AI-powered features via scheduled data reporting
6. **Minimal Footprint**: Lightweight operator that doesn't impact cluster performance

### Strategic Goals

**Short-Term (6-12 months)**
- Establish operator as the standard for kube9 cluster integration
- Achieve 1,000+ operator installations across diverse cluster types
- Build trust through transparent security model and minimal resource usage
- Enable seamless Pro tier activation through operator registration

**Medium-Term (1-2 years)**
- Complete remaining data collectors (performance metrics, config patterns, security posture)
- Support for multi-cluster federation and management
- **ArgoCD Integration**: Seamless integration with ArgoCD for enhanced drift detection and GitOps intelligence
- **Kubernetes Well-Architected Framework**: Operator-side validation for all 6 framework pillars (Security, Reliability, Performance Efficiency, Cost Optimization, Operational Excellence, Sustainability)
- Advanced health checks and predictive analytics

**Long-Term (2+ years)**
- Become the standard operator for Kubernetes observability
- Enable cross-cluster analytics and insights
- Support for edge clusters and air-gapped environments
- Build operator marketplace for extensibility

## Key Principles

### 1. Security First
- No ingress required - all communication is outbound
- Minimal RBAC permissions - only what's necessary
- No sensitive data exposure - sanitized metrics only
- Non-root execution with read-only filesystem

### 2. Minimal Resource Footprint
- Lightweight design (~100m CPU, 128Mi RAM)
- Efficient status updates (configurable intervals)
- No impact on cluster performance
- Graceful degradation under resource constraints

### 3. Tier-Aware Architecture
- Supports multiple tiers (basic, operated, enabled, degraded)
- Clear status exposure for VS Code extension
- Graceful fallback when Pro tier unavailable
- Transparent tier detection and reporting

### 4. Operational Excellence
- Simple installation via Helm
- Clear status reporting and health checks
- Comprehensive logging for troubleshooting
- Easy upgrades and configuration changes

### 5. Privacy & Compliance
- User controls what operator can access via RBAC
- No secrets or credentials collected
- Audit trail for all operations
- Compliance with data protection regulations

## What Makes kube9-operator Unique

### Competitive Advantages

1. **Zero Ingress Architecture**: Unlike other operators, requires no ingress - all communication is outbound
2. **Tier Detection**: Enables progressive enhancement in VS Code extension based on cluster capabilities
3. **Minimal Footprint**: Lightweight design that doesn't impact cluster performance
4. **Security Model**: Transparent security model with minimal permissions and no sensitive data collection
5. **Progressive Enhancement**: Works in free tier mode, unlocks Pro features when API key provided
6. **Data Collection Foundation**: Secure, sanitized metrics collection for AI training and insights

### Differentiation from Competitors

- **vs. Prometheus Operator**: Focused on kube9 integration vs. general metrics collection
- **vs. Other Observability Operators**: No ingress required vs. requiring cluster ingress
- **vs. Cloud-Specific Operators**: Works with any cluster vs. cloud-specific solutions
- **vs. Generic Operators**: Purpose-built for kube9 ecosystem vs. generic functionality

## Kubernetes Well-Architected Framework

### Free Tier Framework Validation

**Role**: The kube9-operator is the foundation for implementing the Kubernetes Well-Architected Framework, providing validation for all 6 framework pillars. Free tier checks run without an API key, while Pro tier analysis requires scheduled data reporting.

**Framework Documentation**: Complete framework documentation with all criteria: https://alto9.github.io/kube9/well-architected-framework.html

**Free Tier Responsibilities:**

The operator performs validation checks that require real resource names and cluster access. These checks are available without an API key:

**Security Pillar:**
- Image CVE vulnerability scanning (Trivy/Grype integration)
- CIS Kubernetes Benchmark compliance checks
- NSA/CISA hardening guide validation
- Security context validation (RunAsNonRoot, privileged containers, capabilities)
- RBAC policy analysis (wildcard permissions, cluster-admin misuse)
- Secret management audits

**Reliability Pillar:**
- High availability configuration validation (multi-replica, PDB, anti-affinity)
- Resource limits and requests validation
- Health check configuration (liveness/readiness probes)
- Backup and disaster recovery validation

**Performance Efficiency Pillar:**
- Autoscaling configuration (HPA, VPA, cluster autoscaler)
- Resource quotas and limits validation
- Node affinity and anti-affinity checks

**Cost Optimization Pillar:**
- Resource configuration validation (requests/limits presence and ratios)
- Spot instance configuration validation

**Operational Excellence Pillar:**
- Monitoring and observability validation (Prometheus, metrics endpoints)
- Logging and audit trail configuration
- Deployment strategy validation (rolling, canary, blue-green)
- GitOps best practices (ArgoCD/Flux detection and validation)

**Sustainability Pillar:**
- Resource efficiency metrics (planned)
- Workload consolidation opportunities (planned)

**Dual-Tier Architecture:**

The operator works in conjunction with kube9-server Pro tier analysis:
- **Free Tier**: Validates configurations requiring real names (CVE scanning, compliance checks). Available without API key.
- **Pro Tier**: Analyzes patterns and trends using obfuscated data (exposure detection, trend analysis). Requires API key for scheduled data reporting.

This dual-tier approach provides comprehensive framework coverage while maintaining data privacy.

## ArgoCD Integration Vision

### Making ArgoCD Smarter with AI

**Opportunity**: ArgoCD is the market-leading GitOps solution, deployed in production clusters worldwide. However, users struggle with understanding drift causes, troubleshooting deployment failures, and optimizing GitOps configurations. ArgoCD provides excellent deployment mechanics but lacks intelligent insights.

**Solution**: Seamless integration with ArgoCD through the kube9 operator to provide enhanced drift detection visualization, AI-powered troubleshooting recommendations, and intelligent insights based on GitOps deployment patterns.

### Integration Capabilities

1. **Drift Detection Enhancement**: Monitor and visualize ArgoCD-detected drift with context and root cause analysis
2. **AI-Powered Troubleshooting**: Analyze deployment failures and provide actionable recommendations
3. **VS Code Native Views**: View ArgoCD Applications and sync status directly in VS Code
4. **Conditional Integration**: Automatically detects ArgoCD presence - works with or without it
5. **Free Tier Feature**: ArgoCD integration available in free tier to drive adoption

### How It Works

**Detection Phase**:
- Operator detects ArgoCD installation in cluster
- Monitors ArgoCD Applications and their sync status
- Collects drift information and deployment events

**Enhancement Phase (Free Tier)**:
- Visualize ArgoCD data in VS Code with native UI
- View sync status, drift alerts, and deployment history
- Access basic drift detection summaries

**Intelligence Phase (Pro Tier - Future)**:
- AI analysis of drift patterns and root causes
- Predictive deployment failure detection
- Configuration optimization recommendations
- GitOps best practice suggestions

### User Experience

**For Developers**:
- View ArgoCD Applications directly in VS Code kube9 tree view
- See drift alerts and sync status without leaving IDE
- Get AI-powered recommendations for deployment issues (Pro tier)
- Unified interface for both cluster resources and GitOps deployments

**For Platform Teams**:
- Centralized visibility across all clusters with ArgoCD
- Drift pattern analytics across multiple applications
- Troubleshooting insights reduce MTTR
- GitOps configuration optimization recommendations

## Target Outcomes

### For Cluster Operators
- **Easy Integration**: Simple Helm install to enable kube9 features
- **Security Confidence**: Transparent security model with minimal permissions
- **Performance Assurance**: Lightweight operator that doesn't impact cluster performance
- **Tier Flexibility**: Choose free tier or Pro tier based on needs

### For Developers
- **Seamless Experience**: Operator enables VS Code extension features automatically
- **Pro Tier Activation**: Simple API key configuration unlocks advanced features
- **Health Visibility**: Clear status reporting for cluster health
- **Multi-Cluster Support**: Manage multiple clusters with consistent operator behavior

### For Alto9
- **Ecosystem Foundation**: Operator enables Pro tier features and monetization
- **Data Collection**: Foundation built for secure, sanitized metrics collection for AI training
- **Market Differentiation**: Unique zero-ingress architecture sets kube9 apart
- **Scalability**: Operator scales to thousands of clusters efficiently

## Success Metrics

### Adoption
- 1,000+ operator installations in first year
- 50%+ of Pro tier users have operator installed
- < 5 minute average installation time
- 4.5+ star rating in Helm charts

### Performance
- < 100m CPU usage per operator instance
- < 128Mi memory usage per operator instance
- 99.9%+ uptime for operator pods
- < 1% impact on cluster performance

### Security
- Zero security incidents related to operator
- 100% compliance with security best practices
- Transparent security audit results
- No sensitive data exposure incidents

### Reliability
- < 1% operator failure rate
- < 60 second status update latency
- 99.9%+ successful Pro tier registrations
- Graceful degradation under all failure scenarios

## Data Collection Status

### Current Implementation (2/5 Categories Complete)

**✅ Implemented Collectors:**
- **Cluster Metadata**: Kubernetes version, node count, provider detection (24h intervals)
- **Resource Inventory**: Namespace counts, pod/deployment/service counts (6h intervals)

**✅ Collection Infrastructure Complete:**
- Collection scheduler with randomized timing to prevent load spikes
- Local storage for collected data (raw, unsanitized)
- Full documentation and public transparency

**❌ Remaining Collectors (3/5):**
- Resource Configuration Patterns (12h intervals)
- Performance Metrics with Prometheus integration (15min intervals)
- Security Posture indicators (24h intervals)

**❌ Future: PII Sanitization & Server Integration (Post-Collection):**
- Obfuscation library (maintains real name → mock name mappings)
- Outgoing sanitization (replaces real names with mocks before transmission)
- Transmission client for Pro tier with retry logic and exponential backoff
- Incoming reconciliation (reverses mocking on AI responses from server)
- Validation framework ensuring no sensitive data escapes

**📋 Status**: Collection infrastructure is solid. Two collectors implemented with raw data collection. Sanitization and server transmission are separate future phases.

## Data Lifecycle: Collection → Sanitization → AI → Reconciliation

The kube9-operator manages data through four distinct phases:

### Phase 1: Raw Data Collection (Current)
- Collectors gather raw, unsanitized data from cluster resources
- Data includes actual resource names, labels, configurations
- Stored locally in operator pod for verification and future processing
- No data leaves the cluster at this phase
- **Status**: Partially implemented (2/5 collectors complete)

### Phase 2: Obfuscation Library (Future)
- Maintains bidirectional mappings: real name ↔ mock name
- Example: `my-app-deployment` → `deployment-a7f3b9`
- Mappings persist across collections for consistency
- Library stored locally in operator pod
- Enables reversible sanitization
- **Status**: Not yet implemented

### Phase 3: Outgoing Sanitization (Future - Pro Tier Only)
- Applies obfuscation library to raw collected data
- Replaces real names with mock equivalents before transmission
- Ensures no PII or sensitive data leaves the cluster
- Validates sanitized payload before transmission
- Transmits to kube9-server via HTTPS POST with API key
- **Status**: Not yet implemented

### Phase 4: Response Processing (Future - Pro Tier Only)
- Server processes sanitized data and generates AI insights
- Server response includes updated insights, recommendations, and framework assessment results
- AI insights contain mock names (e.g., `deployment-a7f3b9`)
- Operator reverses obfuscation using local library
- Reconstructs insights with actual resource names
- Stores AI insights and updated data in SQLite database for CLI-based querying
- VS Code extension and UI components query via `kubectl exec` to CLI tool
- **Status**: Not yet implemented

### Design Principles

**Separation of Concerns**: Each phase has a distinct responsibility, enabling independent development and testing.

**Privacy by Default**: Raw data never leaves the cluster. Sanitization is mandatory before any external transmission.

**Reversible Obfuscation**: Mock names can be mapped back to real names, enabling AI insights to reference actual cluster resources.

**Free Tier Benefits**: Collection and local storage work without Pro tier, providing value without external connectivity.

**Pro Tier Enhancement**: Sanitization and server integration unlock AI-powered insights while maintaining security.

## AI Insights Architecture (Pro Tier)

### Overview

The operator participates in a sophisticated AI insights system that provides proactive cluster intelligence while maintaining zero-trust security principles.

### Insights Flow (Egress Only)

**1. Metrics Upload (Every 15-60 minutes)**
- Operator collects and sanitizes metrics
- POST to kube9-server `/api/metrics`
- Server stores for analysis and processes AI insights
- Server response includes updated insights and recommendations
- Operator receives and stores updated data from response

**2. Insights Retrieval**
- Updated insights and recommendations included in metrics upload response
- Server processes AI analysis and includes results in response payload
- Insights contain obfuscated object names
- Operator de-obfuscates and stores locally

**3. Local De-obfuscation**
- Operator reverses mock names to real names
- Example: `deployment-a7f3b9` → `my-app-deployment`
- Uses local obfuscation library for mapping
- Reconstructed insights reference actual cluster objects

**4. Storage in SQLite Database**
- Stores de-obfuscated insights in local SQLite database (`/data/kube9.db`)
- VS Code extension queries via `kubectl exec` to CLI tool
- No server call required - all data local to cluster
- Queryable with filters (severity, namespace, date range, etc.)
- See "Data Storage & Query Architecture" section for full schema and CLI commands

**5. Acknowledgement Sync**
- User acknowledges insight in VS Code or UI component
- Extension/UI patches OperatorStatus CRD locally
- Operator detects change and syncs to server
- POST to `/api/insights/{id}/acknowledge`
- Server marks insight as acknowledged
- Updated acknowledgement status included in next metrics upload response

### Insight Data Model

Each insight contains:

**Identity & Target:**
- `id` - Unique insight identifier
- `cluster_id` - Which cluster (obfuscated at server)
- `object_kind` - Deployment, Pod, Service, Node, Namespace, Cluster
- `object_namespace` - Namespace (null for cluster-level)
- `object_name` - Object name (de-obfuscated by operator)
- `object_id` - Composite identifier

**Content:**
- `insight_type` - issue, optimization, security, cost, health, trend
- `severity` - critical, high, medium, low, info
- `title` - Short headline
- `insight_text` - Full AI-generated explanation
- `recommendation` - Actionable next steps

**State:**
- `status` - active, acknowledged, resolved, dismissed
- `acknowledged_at` - Timestamp
- `created_at` - When insight was generated
- `expires_at` - Optional expiration

**Metadata:**
- `confidence` - AI confidence score (0.0-1.0)
- `generation_method` - scheduled, event-triggered, user-requested

### Security & Privacy

**Name Obfuscation:**
- All resource names obfuscated before leaving cluster
- Server never sees real names: `my-app` → `app-x7f3`
- Bidirectional mapping maintained only in operator
- De-obfuscation happens only at operator after receiving insights

**Zero-Trust Communication:**
- All communication is outbound (egress only)
- No ingress to cluster required
- Operator polls server on schedule
- Server cannot push to operator

**Data Minimization:**
- Only sanitized metrics sent to server
- No secrets, credentials, or sensitive data
- User controls what operator can access via RBAC

### Graceful Degradation

**If server unreachable:**
- Operator continues collecting metrics locally
- Cached insights remain available to VS Code
- Polling retries with exponential backoff
- No impact on cluster operations

**If API key invalid:**
- Falls back to free tier behavior
- Local metrics collection continues
- No insights from server
- Clear status indication in VS Code

### Performance Characteristics

**Resource Usage:**
- Insights polling: <10ms CPU, <1MB memory
- Local storage: ~100KB per 50 insights
- De-obfuscation: <5ms per insight batch
- Network: ~50KB per insights fetch

**Latency:**
- Insights appear within 1 hour of generation
- Acknowledgements sync within 5 minutes
- No impact on cluster performance
- Efficient caching minimizes overhead

## Data Storage & Query Architecture

### Architectural Decision: CLI-Based Query Interface

After evaluating multiple approaches for storing and retrieving operator-managed data (AI insights, framework assessments, derived analytics), we chose a **CLI-based query interface** backed by **SQLite** over alternatives like ConfigMaps or Custom Resource Definitions (CRDs).

#### Why Not ConfigMaps?

ConfigMaps were the initial implementation but have significant drawbacks:

| Concern | ConfigMap Limitation |
|---------|---------------------|
| Semantic fit | Designed for configuration, not runtime state |
| Size | 1MB limit becomes problematic as data grows |
| Schema validation | None - data corruption possible |
| Query capability | None - must retrieve entire ConfigMap |
| Versioning | Manual, error-prone |

#### Why Not CRDs?

CRDs are more Kubernetes-native but still limited:

| Concern | CRD Limitation |
|---------|---------------|
| Query capability | Limited - must retrieve entire resource |
| Complex data | Awkward for relational data (insights → assessments → resources) |
| Historical data | Not designed for time-series or historical queries |
| Size | While larger than ConfigMaps, still constrained |

#### Why CLI + SQLite?

The CLI-based approach provides:

1. **Rich query capability** - Full SQL underneath, exposed through purpose-built commands
2. **Complex data modeling** - Relational data with proper foreign keys and indexes
3. **Historical queries** - Time-series data, trending, "since" filters
4. **Versioned API contract** - CLI commands are the API, can be versioned and evolved
5. **Testable in isolation** - CLI can be tested without Kubernetes
6. **Clean JSON output** - No parsing issues, proper structured data
7. **Single artifact** - Same binary for operator and CLI (Go makes this trivial)
8. **Debuggable** - Ops team can exec into pod and run queries manually

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         kube9-operator pod                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────┐         ┌─────────────────────────────────┐  │
│   │  Operator Loop  │         │      SQLite Database            │  │
│   │  (serve mode)   │────────▶│      /data/kube9.db             │  │
│   │                 │  writes │                                 │  │
│   │  - Collectors   │         │  Tables:                        │  │
│   │  - Server sync  │         │  - operator_status              │  │
│   │  - Assessments  │         │  - insights                     │  │
│   └─────────────────┘         │  - assessments                  │  │
│                               │  - assessment_history           │  │
│   ┌─────────────────┐         │  - argocd_apps                  │  │
│   │   CLI Tool      │────────▶│  - collections                  │  │
│   │  (query mode)   │  reads  │  - obfuscation_map              │  │
│   └─────────────────┘         └─────────────────────────────────┘  │
│          ▲                                                          │
└──────────│──────────────────────────────────────────────────────────┘
           │
           │ kubectl exec ... kube9-operator query <command>
           │
┌──────────│──────────────────────────────────────────────────────────┐
│          │              kube9-vscode / kube9-ui                     │
│          │                                                          │
│   OperatorQueryClient                                               │
│   - getStatus()                                                     │
│   - getInsights(filters)                                            │
│   - getAssessments(filters)                                         │
│   - getArgoCDApps()                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Single Binary, Multiple Modes

The kube9-operator binary serves double duty:

```
kube9-operator
├── serve                    # Default: run the operator
│   └── (reconcile loop, collectors, server sync, assessments)
│
└── query                    # CLI mode: query stored data
    ├── status               # Operator status, health, registration
    ├── insights             # AI insights from kube9-server
    │   ├── list             # List with filters (severity, namespace, since)
    │   └── get <id>         # Get specific insight by ID
    ├── assessments          # Framework assessment results
    │   ├── list             # List assessments (by pillar, status)
    │   ├── summary          # Current compliance summary across all pillars
    │   └── history          # Historical results for trending
    ├── argocd               # ArgoCD integration data
    │   ├── apps             # Application status and sync state
    │   └── drift            # Drift detection results
    └── collections          # Raw collection data (debug/advanced)
        ├── list             # List recent collections
        └── get <id>         # Get specific collection
```

### CLI Command Examples

**Operator Status:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query status --format=json
```

**List High-Severity Insights:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query insights list \
    --severity=high,critical \
    --namespace=production \
    --since=24h \
    --format=json
```

**Framework Assessment Summary:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query assessments summary --format=json
```

**Security Pillar Failing Checks:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query assessments list \
    --pillar=security \
    --status=failing \
    --format=json
```

**ArgoCD Application Status:**
```bash
kubectl exec -n kube9-system deploy/kube9-operator -- \
  kube9-operator query argocd apps --format=json
```

### SQLite Database Schema

The operator maintains a SQLite database at `/data/kube9.db`:

```sql
-- Operator status (single row, updated frequently)
CREATE TABLE operator_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL,           -- 'operated' | 'enabled'
  tier TEXT NOT NULL,           -- 'free' | 'pro'
  version TEXT NOT NULL,
  health TEXT NOT NULL,         -- 'healthy' | 'degraded' | 'unhealthy'
  registered BOOLEAN NOT NULL,
  cluster_id TEXT,
  error TEXT,
  last_update TEXT NOT NULL
);

-- AI insights from kube9-server
CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  object_kind TEXT NOT NULL,
  object_namespace TEXT,
  object_name TEXT NOT NULL,
  insight_type TEXT NOT NULL,   -- 'issue' | 'optimization' | 'security' | etc.
  severity TEXT NOT NULL,       -- 'critical' | 'high' | 'medium' | 'low' | 'info'
  title TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  recommendation TEXT,
  status TEXT NOT NULL,         -- 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  confidence REAL,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  expires_at TEXT
);

-- Framework assessment results
CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  pillar TEXT NOT NULL,         -- 'security' | 'reliability' | 'performance' | etc.
  check_id TEXT NOT NULL,
  check_name TEXT NOT NULL,
  status TEXT NOT NULL,         -- 'passing' | 'failing' | 'warning' | 'skipped'
  object_kind TEXT,
  object_namespace TEXT,
  object_name TEXT,
  message TEXT,
  remediation TEXT,
  assessed_at TEXT NOT NULL
);

-- Historical assessment results for trending
CREATE TABLE assessment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pillar TEXT NOT NULL,
  passing_count INTEGER NOT NULL,
  failing_count INTEGER NOT NULL,
  warning_count INTEGER NOT NULL,
  assessed_at TEXT NOT NULL
);

-- ArgoCD application data
CREATE TABLE argocd_apps (
  name TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  project TEXT NOT NULL,
  sync_status TEXT NOT NULL,    -- 'Synced' | 'OutOfSync' | 'Unknown'
  health_status TEXT NOT NULL,  -- 'Healthy' | 'Degraded' | 'Progressing' | etc.
  repo_url TEXT,
  path TEXT,
  target_revision TEXT,
  last_sync_at TEXT,
  updated_at TEXT NOT NULL
);

-- Name obfuscation mappings (for server communication)
CREATE TABLE obfuscation_map (
  real_name TEXT PRIMARY KEY,
  mock_name TEXT NOT NULL UNIQUE,
  object_kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Raw collection data (debug/advanced use)
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  collection_type TEXT NOT NULL,
  data TEXT NOT NULL,           -- JSON blob
  collected_at TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_insights_severity ON insights(severity);
CREATE INDEX idx_insights_namespace ON insights(object_namespace);
CREATE INDEX idx_insights_status ON insights(status);
CREATE INDEX idx_insights_created ON insights(created_at);
CREATE INDEX idx_assessments_pillar ON assessments(pillar);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessment_history_date ON assessment_history(assessed_at);
```

### Data Persistence

The SQLite database is stored on a PersistentVolumeClaim:

```yaml
# In Helm chart
volumes:
  - name: data
    persistentVolumeClaim:
      claimName: kube9-operator-data

volumeMounts:
  - name: data
    mountPath: /data

# PVC definition
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: kube9-operator-data
  namespace: kube9-system
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi  # Plenty for SQLite
```

### RBAC Requirements

The CLI approach requires `exec` permission rather than just `get configmap`:

```yaml
# For extension users querying operator data
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kube9-query
  namespace: kube9-system
rules:
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get"]  # To resolve deploy/kube9-operator to pod
```

### CLI Output Format

All CLI commands support `--format` flag:

| Format | Use Case |
|--------|----------|
| `json` | Default, for programmatic consumption |
| `yaml` | Human-readable structured output |
| `table` | Human-readable tabular output |

Example JSON output for `query status`:
```json
{
  "mode": "enabled",
  "tier": "pro",
  "version": "1.2.0",
  "health": "healthy",
  "registered": true,
  "clusterId": "cls_abc123def456",
  "error": null,
  "lastUpdate": "2025-11-27T10:30:00Z"
}
```

Example JSON output for `query insights list`:
```json
{
  "insights": [
    {
      "id": "ins_abc123",
      "objectKind": "Deployment",
      "objectNamespace": "production",
      "objectName": "api-server",
      "insightType": "issue",
      "severity": "high",
      "title": "CPU throttling detected",
      "insightText": "The api-server deployment is experiencing CPU throttling...",
      "recommendation": "Increase CPU limits to 500m",
      "status": "active",
      "confidence": 0.92,
      "createdAt": "2025-11-27T09:15:00Z"
    }
  ],
  "total": 1,
  "filters": {
    "severity": ["high", "critical"],
    "namespace": "production",
    "since": "24h"
  }
}
```

### Migration from ConfigMap

The current implementation uses a ConfigMap for status. The migration path:

1. **Phase 1 (Current)**: ConfigMap-based status (simple, limited)
2. **Phase 2 (Next)**: Add SQLite + CLI alongside ConfigMap (parallel operation)
3. **Phase 3 (Future)**: Deprecate ConfigMap, CLI becomes primary interface
4. **Phase 4 (Final)**: Remove ConfigMap code

This allows gradual migration without breaking existing extension versions.

## Future Possibilities

### Advanced Capabilities
- Multi-cluster federation and management
- Complete remaining data collectors (performance metrics, config patterns, security)
- **Enhanced ArgoCD Integration**: Deep integration with ArgoCD for drift intelligence and AI-powered GitOps insights
- Edge cluster and air-gapped environment support
- Custom metrics and health check plugins

### UI Access Points
- **VS Code Extension**: Primary interface for VS Code users (kube9-vscode)
- **Web UI**: Browser-based interface for non-VSCode users (kube9-ui - separate open source project)
- Both interfaces query the operator via `kubectl exec` to the CLI tool
- CLI provides rich query capabilities (filters, date ranges, aggregations)
- Operator remains the core - interfaces are access points to operator outputs

### Ecosystem Integration
- Integration with other Kubernetes operators
- Support for operator marketplace
- Custom resource definitions for kube9 resources
- Integration with Kubernetes native tools

### Platform Expansion
- Support for other container orchestration platforms
- Integration with cloud-native ecosystems
- Support for hybrid and multi-cloud deployments
- Edge computing and IoT cluster support

## Core Values

1. **Security**: Security is not optional - it's fundamental to everything we build
2. **Simplicity**: Complex problems deserve simple solutions
3. **Transparency**: Clear about what the operator does and how it works
4. **Performance**: Minimal resource footprint is a feature, not a compromise
5. **Reliability**: Operators must work reliably in production environments

---

**Built with ❤️ by Alto9 - Making Kubernetes management intelligent**

