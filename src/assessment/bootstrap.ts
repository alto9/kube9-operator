/**
 * Assessment Registry Bootstrap
 *
 * Wires initial built-in checks into the registry at startup.
 * Call bootstrapAssessmentRegistry() during operator initialization.
 */

import type { AssessmentCheck } from './types.js';
import { getRegistry } from './registry.js';
import {
  runAsNonRootCheck,
  privilegedContainersCheck,
  capabilitiesValidationCheck,
  rbacWildcardPermissionsCheck,
  rbacClusterAdminMisuseCheck,
  secretsInConfigMapsCheck,
  externalSecretsUsageCheck,
  hardcodedSecretsCheck,
  storedVulnerabilityThresholdsCheck,
} from './checks/security/index.js';
import {
  replicaCountsCheck,
  spreadAntiAffinityCheck,
  podDisruptionBudgetsCheck,
  resourceRequestsCheck,
  resourceLimitsCheck,
  livenessReadinessProbesCheck,
  backupDrSignalsCheck,
} from './checks/reliability/index.js';
import {
  hpaConfigurationSanityCheck,
  vpaConfigurationSanityCheck,
  namespaceResourceGovernanceCheck,
  nodeAffinityAndPlacementCheck,
} from './checks/performance-efficiency/index.js';
import {
  resourceRequestLimitRatiosCheck,
  overProvisioningDetectionCheck,
  spotInstanceUsageCheck,
} from './checks/cost-optimization/index.js';
import {
  kube9OperatorHealthProbesCheck,
  kube9OperatorMetricsExposureCheck,
  kube9OperatorLoggingConfigurationCheck,
  kube9OperatorAuditSignalsCheck,
  kube9OperatorDeploymentStrategyCheck,
  gitopsDeliverySignalsCheck,
} from './checks/operational-excellence/index.js';
import { resourceEfficiencySignalsCheck } from './checks/sustainability/index.js';

/** Built-in checks to register at bootstrap (extend as checks are implemented) */
const BUILT_IN_CHECKS: AssessmentCheck[] = [
  runAsNonRootCheck,
  privilegedContainersCheck,
  capabilitiesValidationCheck,
  rbacWildcardPermissionsCheck,
  rbacClusterAdminMisuseCheck,
  secretsInConfigMapsCheck,
  externalSecretsUsageCheck,
  hardcodedSecretsCheck,
  storedVulnerabilityThresholdsCheck,
  replicaCountsCheck,
  spreadAntiAffinityCheck,
  podDisruptionBudgetsCheck,
  resourceRequestsCheck,
  resourceLimitsCheck,
  livenessReadinessProbesCheck,
  backupDrSignalsCheck,
  hpaConfigurationSanityCheck,
  vpaConfigurationSanityCheck,
  namespaceResourceGovernanceCheck,
  nodeAffinityAndPlacementCheck,
  resourceRequestLimitRatiosCheck,
  overProvisioningDetectionCheck,
  spotInstanceUsageCheck,
  kube9OperatorHealthProbesCheck,
  kube9OperatorMetricsExposureCheck,
  kube9OperatorLoggingConfigurationCheck,
  kube9OperatorAuditSignalsCheck,
  kube9OperatorDeploymentStrategyCheck,
  gitopsDeliverySignalsCheck,
  resourceEfficiencySignalsCheck,
];

/**
 * Bootstrap the assessment check registry with built-in checks.
 * Validates all checks and fails fast on first invalid or duplicate.
 * Calling this when checks are already registered throws; the operator uses
 * `ensureAssessmentRegistryBootstrapped` in `scheduled-tick.ts` for idempotent wiring.
 */
export function bootstrapAssessmentRegistry(): void {
  const registry = getRegistry();
  registry.bootstrap(BUILT_IN_CHECKS);
}
