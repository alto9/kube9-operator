# Helm chart implementation summary

> **Note (2026):** The chart **no longer** exposes Helm values or templates for operator API keys or Pro-tier Secrets. Default validation is **single-path**: install the chart, confirm no chart-managed credential Secret, and verify `helm template` output stays free of `API_KEY`. Historical bullets below that reference `apiKey` / Pro tier describe an earlier design iteration.

## Chart contents

- **Deployment**: operator pod with health probes, configurable env from values (no install-time credential keys in Helm values).
- **ServiceAccount** and **RBAC**: optional creation via `serviceAccount.create` and `rbac.create`.
- **PVC**: optional event persistence via `events.persistence`.
- **NOTES.txt**: post-install guidance (ArgoCD awareness and operational commands).

## Validation

- `node scripts/validate-chart.js` — structure and policy checks (no `secret.yaml`, no API key wiring in templates).
- `helm lint charts/kube9-operator`
- `./scripts/test-helm-chart.sh` — lint, template, package, and optional Kind install for default values.

## Testing notes

- Default `helm template` / `helm install` must not create a Secret for install-time credentials or inject a legacy credential environment variable on the Deployment.
- Registration and tier transitions are operator runtime concerns; they are not configured through Helm values in this chart.
