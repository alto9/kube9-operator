# User Stories

## Status Exposure
- Extension queries operator status → returns operated, tier free
- Extension detects operator not installed → basic mode, installation prompts
- Operator status via ConfigMap, JSON format, includes health, namespace
- Status updated every 60 seconds; stale (>5 min) treated as unhealthy

## ArgoCD Awareness
- ArgoCD detected in default or custom namespace (M1: config overrides)
- ArgoCD not installed → graceful degradation
- M9: Application sync/health status, drift detection
- VS Code extension reads ArgoCD status for conditional features

## Event System
- Record Kubernetes Events (Pod failures, node issues, etc.)
- Record operator lifecycle (startup, shutdown, health transitions)
- Record assessments
- Non-blocking event recording; async queue
- Query via CLI with filters (type, severity, date, object)

## Data Collection (M8)
- Cluster metadata on schedule (24h)
- Resource inventory on schedule (6h)
- Resource configuration patterns on schedule (12h)
- Random offset to distribute load
- Collection errors handled gracefully
