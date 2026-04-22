# Built-In Assessment Checks Reference

This document is the authoritative reference for all checks currently registered in `src/assessment/bootstrap.ts` via `BUILT_IN_CHECKS`.

## Outcome Semantics

- `passing`: The check conditions are satisfied.
- `warning`: A non-blocking risk or best-practice gap is detected.
- `failing`: A clear misconfiguration or policy violation is detected.
- `skipped`: The check cannot run because a required signal/integration is unavailable.

Some checks only emit a subset of these outcomes.

## Security

### `security.run-as-non-root` - Run as Non-Root

- **Purpose:** Ensure workloads do not run containers as root.
- **Reads:** Pod and container `securityContext.runAsNonRoot` across all namespaces.
- **Outcomes:** `passing` when all containers inherit or set `runAsNonRoot: true`; `failing` when false or missing.
- **Prerequisites / optional data sources:** Kubernetes Pod API access.
- **Example interpretation/remediation:** If a Deployment fails this check, set pod or container `securityContext.runAsNonRoot: true` and use a non-zero `runAsUser`.

### `security.privileged-containers` - No Privileged Containers

- **Purpose:** Detect containers with `privileged: true`.
- **Reads:** Pod and container security context for all Pods.
- **Outcomes:** `passing` when no privileged containers are found; `failing` otherwise.
- **Prerequisites / optional data sources:** Kubernetes Pod API access.
- **Example interpretation/remediation:** Remove `privileged: true` and grant only specific capabilities required by the workload.

### `security.capabilities-validation` - Capabilities Validation

- **Purpose:** Validate Linux capability usage follows least privilege.
- **Reads:** Pod/container capability add/drop settings.
- **Outcomes:** `passing` when dangerous capabilities are not added unsafely; `failing` when dangerous capability patterns are detected.
- **Prerequisites / optional data sources:** Kubernetes Pod API access.
- **Example interpretation/remediation:** Add `drop: ["ALL"]` and explicitly re-add only narrowly required capabilities.

### `security.rbac-wildcard-permissions` - RBAC Wildcard Permissions

- **Purpose:** Detect overly broad RBAC grants.
- **Reads:** Roles and ClusterRoles for wildcard (`*`) resources, verbs, or API groups.
- **Outcomes:** `passing` when no wildcard grants are found; `failing` when wildcard access is detected.
- **Prerequisites / optional data sources:** Kubernetes RBAC API access.
- **Example interpretation/remediation:** Replace wildcard grants with explicit resources and verbs for each service account.

### `security.rbac-cluster-admin-misuse` - RBAC Cluster-Admin Misuse

- **Purpose:** Detect cluster-admin bindings outside expected system contexts.
- **Reads:** ClusterRoleBindings and namespace scope for subjects bound to `cluster-admin`.
- **Outcomes:** `passing` when cluster-admin is not misapplied; `failing` when non-system misuse is found.
- **Prerequisites / optional data sources:** Kubernetes RBAC API access.
- **Example interpretation/remediation:** Replace cluster-admin bindings with namespace-scoped Roles/RoleBindings and custom least-privilege ClusterRoles.

### `security.secrets-in-configmaps` - Secrets in ConfigMaps

- **Purpose:** Prevent sensitive values being stored in ConfigMaps.
- **Reads:** ConfigMap keys and values (including `binaryData`) with secret-like heuristics.
- **Outcomes:** `passing` when no likely secret data exists in ConfigMaps; `failing` when likely secret material is found.
- **Prerequisites / optional data sources:** Kubernetes ConfigMap API access.
- **Example interpretation/remediation:** Move values to Kubernetes Secrets or external-secrets and reference them via `valueFrom.secretKeyRef`.

### `security.external-secrets-usage` - External Secrets Usage

- **Purpose:** Encourage secure external secret management adoption.
- **Reads:** Presence of `externalsecrets.external-secrets.io` CRD.
- **Outcomes:** `passing` when External Secrets CRD is detected; `warning` when not detected.
- **Prerequisites / optional data sources:** Kubernetes CRD API access.
- **Example interpretation/remediation:** Install external-secrets and source secrets from Vault or cloud secret managers.

### `security.hardcoded-secrets` - Hardcoded Secrets in Workloads

- **Purpose:** Detect likely hardcoded credentials in workload env vars.
- **Reads:** Deployment and StatefulSet container `env` values (`value`, not `valueFrom`), using secret heuristics.
- **Outcomes:** `passing` when no hardcoded secrets are detected; `failing` when likely secret literals exist.
- **Prerequisites / optional data sources:** Kubernetes Deployment and StatefulSet API access.
- **Example interpretation/remediation:** Replace literal env values with `valueFrom.secretKeyRef` or external-secrets references.

### `security.stored-vulnerability-thresholds` - Stored vulnerability severity thresholds

- **Purpose:** Enforce vulnerability count ceilings from stored scanner findings.
- **Reads:** Stored vulnerability counts by severity and environment thresholds (`VULN_MAX_CRITICAL`, `VULN_MAX_HIGH`, `VULN_MAX_MEDIUM`).
- **Outcomes:** `passing` when counts are within thresholds; `failing` when thresholds are exceeded; `skipped` when Trivy status is available but scanning is not detected/reachable.
- **Prerequisites / optional data sources:** Stored image scan findings; optional Trivy status integration (`getTrivyStatus`) and `ImageScanRepository`.
- **Example interpretation/remediation:** If critical findings exceed policy, patch/replace affected images before raising threshold values.

## Reliability

### `reliability.replica-counts` - High Availability Replica Counts

- **Purpose:** Ensure HA-relevant workloads run enough replicas.
- **Reads:** Deployment and StatefulSet replica counts, with HA relevance heuristics/labels.
- **Outcomes:** `passing` when HA-relevant workloads meet minimum replicas; `failing` when below target.
- **Prerequisites / optional data sources:** Kubernetes Deployment/StatefulSet API; HA heuristics labels such as `kube9.io/ha-required` and `kube9.io/ha-exempt`.
- **Example interpretation/remediation:** Increase replicas for HA workloads to at least 2 unless explicitly exempted.

### `reliability.spread-anti-affinity` - Pod Spread and Anti-Affinity

- **Purpose:** Reduce correlated failure risk by checking pod placement controls.
- **Reads:** Workload pod templates for topology spread constraints / anti-affinity.
- **Outcomes:** `passing` when suitable spread/anti-affinity is present for HA workloads; `warning` when resilience placement controls are missing.
- **Prerequisites / optional data sources:** Kubernetes workload specs and scheduling policy fields.
- **Example interpretation/remediation:** Add topology spread constraints across zones/nodes and preferred/required anti-affinity rules.

### `reliability.pod-disruption-budgets` - PodDisruptionBudget Coverage

- **Purpose:** Ensure voluntary disruptions preserve availability.
- **Reads:** HA-relevant workloads and matching PodDisruptionBudgets.
- **Outcomes:** `passing` when PDB coverage is present for relevant workloads; `warning` when coverage gaps exist.
- **Prerequisites / optional data sources:** Kubernetes Deployment/StatefulSet and PDB APIs.
- **Example interpretation/remediation:** Create a PDB with `minAvailable` or `maxUnavailable` aligned to your SLO.

### `reliability.resource-requests` - Resource Requests

- **Purpose:** Ensure workloads declare scheduler resource intent.
- **Reads:** Container CPU/memory requests in workload specs.
- **Outcomes:** `passing` when required requests are configured; `failing` when requests are missing.
- **Prerequisites / optional data sources:** Kubernetes workload API access.
- **Example interpretation/remediation:** Add both CPU and memory requests for each container to improve scheduling reliability.

### `reliability.resource-limits` - Resource Limits

- **Purpose:** Flag workloads missing resource guardrails.
- **Reads:** Container CPU/memory limits in workload specs.
- **Outcomes:** `passing` when limits are configured; `warning` when limits are missing.
- **Prerequisites / optional data sources:** Kubernetes workload API access.
- **Example interpretation/remediation:** Add memory and CPU limits to reduce noisy-neighbor and runaway resource incidents.

### `reliability.liveness-readiness-probes` - Liveness and Readiness Probes

- **Purpose:** Verify workloads expose probe-based health semantics.
- **Reads:** Container liveness/readiness probes in workload pod specs.
- **Outcomes:** `passing` when expected probes are configured; `failing` when probes are missing or insufficient.
- **Prerequisites / optional data sources:** Kubernetes workload API access.
- **Example interpretation/remediation:** Add readiness probes to protect traffic and liveness probes for self-healing restart behavior.

### `reliability.backup-dr-signals` - Backup and Disaster Recovery Signals

- **Purpose:** Detect presence of backup/DR posture signals.
- **Reads:** Backup/DR related resources and labels/annotations recognized by the check heuristics.
- **Outcomes:** `passing` when backup/DR signals are present; `warning` when resilience evidence is weak or absent.
- **Prerequisites / optional data sources:** Cluster resources used by configured backup/DR tools.
- **Example interpretation/remediation:** Document and automate backup jobs plus restore tests for stateful workloads.

## Performance Efficiency

### `performance-efficiency.hpa-configuration-sanity` - HPA Configuration Sanity

- **Purpose:** Validate autoscaling configuration quality.
- **Reads:** HorizontalPodAutoscaler objects and scale target settings.
- **Outcomes:** `passing` for sane HPA configuration; `warning` for questionable/non-ideal patterns; `failing` for clearly broken/safety-risk settings.
- **Prerequisites / optional data sources:** Kubernetes autoscaling API (`HPA` objects).
- **Example interpretation/remediation:** Ensure `minReplicas`, `maxReplicas`, and metric targets are coherent for production load behavior.

### `performance-efficiency.vpa-configuration-sanity` - VPA Configuration Sanity

- **Purpose:** Validate Vertical Pod Autoscaler policy and update behavior.
- **Reads:** VerticalPodAutoscaler resources and update/resource policy settings.
- **Outcomes:** `passing` when VPA policies are sane; `warning` for partial/risky settings; `failing` for severe misconfiguration.
- **Prerequisites / optional data sources:** VPA CRDs/resources installed and readable.
- **Example interpretation/remediation:** Tune update mode/resource policies to avoid disruptive or unconstrained recommendation application.

### `performance-efficiency.namespace-resource-governance` - Namespace Resource Governance

- **Purpose:** Assess namespace-level quota/limit governance and workload consistency.
- **Reads:** Namespace `ResourceQuota`, `LimitRange`, and workload request/limit posture.
- **Outcomes:** `passing` when governance controls are healthy; `warning` for soft governance gaps; `failing` for strong governance violations.
- **Prerequisites / optional data sources:** Namespace, ResourceQuota, LimitRange, and workload APIs.
- **Example interpretation/remediation:** Add namespace defaults and quotas so workloads receive bounded, predictable capacity.

### `performance-efficiency.node-affinity-and-placement` - Node Affinity and Placement

- **Purpose:** Detect inefficient or risky scheduling placement rules.
- **Reads:** Affinity, node selector, topology constraints, and placement-related workload metadata.
- **Outcomes:** `passing` for balanced placement strategy; `warning` for potential inefficiencies; `failing` for severe placement anti-patterns.
- **Prerequisites / optional data sources:** Workload scheduling fields and node topology labels.
- **Example interpretation/remediation:** Use affinity/selectors that match real node pools without over-constraining scheduler options.

## Cost Optimization

### `cost-optimization.resource-request-limit-ratios` - Resource Request/Limit Ratios

- **Purpose:** Detect request-to-limit ratio patterns likely to waste capacity or cause throttling pressure.
- **Reads:** Container CPU/memory requests and limits with ratio heuristics.
- **Outcomes:** `passing` for healthy ratios; `warning` for ratio drift; `failing` for severe over/under ratio patterns.
- **Prerequisites / optional data sources:** Workload resource spec access.
- **Example interpretation/remediation:** Right-size request/limit pairs from observed usage so requests track baseline and limits cap spikes appropriately.

### `cost-optimization.over-provisioning-detection` - Over-Provisioning Detection

- **Purpose:** Detect likely over-allocation of resources relative to policy heuristics.
- **Reads:** Workload resource reservations and over-provisioning heuristics.
- **Outcomes:** `passing` when no over-provisioning signal is detected; `warning` for moderate over-allocation; `failing` for high-confidence over-provisioning.
- **Prerequisites / optional data sources:** Workload resource spec access.
- **Example interpretation/remediation:** Reduce inflated requests where sustained utilization is low.

### `cost-optimization.spot-instance-usage` - Spot/Preemptible Capacity Usage

- **Purpose:** Evaluate whether candidate workloads effectively use lower-cost interruption-tolerant capacity.
- **Reads:** Node labels/taints, scheduling constraints, and workload placement to infer spot/preemptible usage posture.
- **Outcomes:** `passing` when spot usage posture is healthy (including acceptable edge cases in check logic); `warning` for limited adoption opportunities; `failing` for clear policy misses.
- **Prerequisites / optional data sources:** Node metadata and workload scheduling configuration.
- **Example interpretation/remediation:** Route stateless or tolerant workloads to spot/preemptible pools with interruption-aware deployment strategy.

## Operational Excellence

### `operational-excellence.kube9-operator-health-probes` - kube9-operator health probes

- **Purpose:** Validate kube9-operator deployment health probe configuration.
- **Reads:** kube9-operator Deployment container liveness/readiness/startup probes.
- **Outcomes:** `passing` when probes are configured correctly; `failing` when misconfigured/missing; `skipped` when kube9-operator Deployment is not discoverable.
- **Prerequisites / optional data sources:** kube9-operator Deployment metadata and pod template.
- **Example interpretation/remediation:** Ensure operator container exposes and wires standard health probe endpoints.

### `operational-excellence.kube9-operator-metrics-exposure` - kube9-operator metrics exposure

- **Purpose:** Validate observability metrics endpoint exposure for the operator.
- **Reads:** kube9-operator Deployment/container port and metrics endpoint configuration.
- **Outcomes:** `passing` when metrics exposure is correctly configured; `warning` for partial/weak exposure; `failing` for broken exposure; `skipped` when operator deployment is unavailable.
- **Prerequisites / optional data sources:** kube9-operator Deployment and container port/env configuration.
- **Example interpretation/remediation:** Expose metrics endpoint on expected port and ensure scrape configuration can reach it.

### `operational-excellence.kube9-operator-logging-configuration` - kube9-operator logging configuration

- **Purpose:** Validate operator logging mode and signal quality.
- **Reads:** kube9-operator deployment/env configuration affecting log level/format.
- **Outcomes:** `passing` for healthy logging configuration; `warning` for suboptimal settings; `failing` for clearly problematic logging config; `skipped` when operator deployment is unavailable.
- **Prerequisites / optional data sources:** kube9-operator Deployment/env configuration.
- **Example interpretation/remediation:** Set structured logs and a production-appropriate log level to improve incident triage.

### `operational-excellence.kube9-operator-audit-signals` - kube9-operator audit signals

- **Purpose:** Ensure operator emits or can surface audit-relevant operational signals.
- **Reads:** kube9-operator deployment/runtime configuration and related audit signal hooks.
- **Outcomes:** `passing` when audit signals are available; `failing` when missing/inadequate; `skipped` when operator deployment is unavailable.
- **Prerequisites / optional data sources:** kube9-operator deployment presence and audit-related config.
- **Example interpretation/remediation:** Enable and retain operator events/logging pathways needed for change/audit review.

### `operational-excellence.kube9-operator-deployment-strategy` - kube9-operator deployment strategy

- **Purpose:** Validate operator rollout strategy for safe change management.
- **Reads:** kube9-operator Deployment strategy and rollout parameters.
- **Outcomes:** `passing` for safe rollout defaults; `warning` for potentially risky but tolerable strategy; `failing` for unsafe strategy choices; `skipped` when operator deployment is unavailable.
- **Prerequisites / optional data sources:** kube9-operator Deployment strategy fields.
- **Example interpretation/remediation:** Use rolling update strategy with bounded unavailable/surge values.

### `operational-excellence.gitops-delivery-signals` - GitOps delivery signals

- **Purpose:** Detect whether declarative GitOps control loops are present.
- **Reads:** Argo CD detection signals (`applications.argoproj.io` CRD and server discovery) and Flux CRD presence.
- **Outcomes:** `passing` when Argo CD or Flux signals are present; `warning` when GitOps posture is incomplete or absent.
- **Prerequisites / optional data sources:** Optional Argo CD env configuration (`ARGOCD_ENABLED`, `ARGOCD_NAMESPACE`, `ARGOCD_SELECTOR`, `ARGOCD_AUTO_DETECT`) and Flux/Argo CRDs.
- **Example interpretation/remediation:** Install and validate Argo CD or Flux so cluster state is reconciled continuously from Git.
