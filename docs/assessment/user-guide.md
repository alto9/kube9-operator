# Well-Architected Assessments User Guide

This guide walks through installing `kube9-operator`, running assessments, and interpreting results without reading TypeScript internals.

## What assessments do

`kube9-operator` evaluates your cluster against built-in Kubernetes Well-Architected checks across six pillars:

- Security
- Reliability
- Performance Efficiency
- Cost Optimization
- Operational Excellence
- Sustainability

Assessments run in two common patterns:

- **Scheduled in operated mode**: the operator loop performs recurring assessments in-cluster.
- **On-demand via CLI**: you run `kube9-operator assess ...` commands, typically through `kubectl exec` against the operator pod.

## Prerequisites

- Kubernetes `1.24+`
- `kubectl` configured for your target cluster
- `helm` `3.x`
- Permission to create namespaces and RBAC resources for installation

## Install and verify the operator

The conventional namespace is `kube9-system` (you can use another namespace if desired).

```bash
helm repo add kube9 https://charts.kube9.io
helm repo update

helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

Verify operator health and status publishing:

```bash
kubectl get pods -n kube9-system
kubectl logs -n kube9-system deployment/kube9-operator
kubectl get configmap kube9-operator-status -n kube9-system -o jsonpath='{.data.status}' | jq .
```

## Helm values that matter for assessments

Most assessment behavior works with chart defaults. These values are commonly tuned:

- `statusUpdateIntervalSeconds`: controls status publication frequency (helps extension/consumers observe freshness).
- `trivy.*` values (especially `trivy.serverUrl`, `trivy.autoDetect`, `trivy.detectionInterval`): impact vulnerability-related checks.
- `argocd.*` values: affect GitOps-related detection signals used by some checks.
- `rbac.create` / `serviceAccount.*`: must allow the operator to read required resources and write status ConfigMaps.

See chart value details in `charts/kube9-operator/README.md`.

## Run assessments on demand (CLI)

In-cluster usage is typically via `kubectl exec` into the operator pod.

```bash
POD=$(kubectl get pod -n kube9-system -l app.kubernetes.io/name=kube9-operator -o jsonpath='{.items[0].metadata.name}')
```

### Run

Full assessment:

```bash
kubectl exec -n kube9-system "$POD" -- kube9-operator assess run --mode full --format table
```

Single pillar (example: security):

```bash
kubectl exec -n kube9-system "$POD" -- kube9-operator assess run --mode pillar --pillar security --format table
```

Single check:

```bash
kubectl exec -n kube9-system "$POD" -- kube9-operator assess run --mode single-check --check-id security.run-as-non-root --format table
```

### List runs

```bash
kubectl exec -n kube9-system "$POD" -- kube9-operator assess list --limit 20 --format table
```

### Get one run by ID

```bash
kubectl exec -n kube9-system "$POD" -- kube9-operator assess get <run-id> --format yaml
```

### Summary and historical trends

```bash
kubectl exec -n kube9-system "$POD" -- kube9-operator assess summary --format table
kubectl exec -n kube9-system "$POD" -- kube9-operator assess history --pillar security --limit 50 --format table
```

## Run modes explained

The `assess run` command supports three modes:

- `full`: evaluate all registered checks.
- `pillar`: evaluate checks in one pillar (requires `--pillar`).
- `single-check`: evaluate one check ID (requires `--check-id`).

If mode-specific required flags are missing, the CLI exits with a clear validation error.

## How to interpret results

Assessment records include run metadata and aggregate counts:

- Run metadata: `run_id`, `mode`, `state`, timestamps.
- Outcome counts: `passed_checks`, `failed_checks`, `warning_checks`, `skipped_checks`, plus error/timeout counts.

For check-level detail and remediation context, use:

- `assess history` to review recent check outcomes over time.
- `docs/assessment/checks.md` for check purpose, prerequisites, and remediation guidance.

In operated mode, status and compatibility signals are also exposed via `kube9-operator-status` ConfigMap for extension and other consumers.

## Known limitations and skipped checks

- `skipped` means a check could not execute because a required signal or optional integration was unavailable.
- Vulnerability-threshold checks can be `skipped` when Trivy is not configured, unreachable, or not detected at run start.
- Checks that inspect operator deployment details can be `skipped` when the expected deployment signal is unavailable.

Treat `skipped` as actionable observability/configuration debt: either wire the dependency (for example Trivy) or consciously accept the reduced coverage.

## Troubleshooting quick hits

- No operator pod found:
  - Confirm namespace and Helm release name.
- Empty/old assessment data:
  - Re-run `assess run`, then `assess list`.
- Permission errors:
  - Verify chart-managed RBAC is enabled and bindings exist.
- Unexpected skipped checks:
  - Validate optional integrations and inspect operator logs for detection errors.
