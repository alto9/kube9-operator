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
} from './checks/security/index.js';
import {
  replicaCountsCheck,
  spreadAntiAffinityCheck,
  podDisruptionBudgetsCheck,
  resourceRequestsCheck,
  resourceLimitsCheck,
  livenessReadinessProbesCheck,
} from './checks/reliability/index.js';

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
  replicaCountsCheck,
  spreadAntiAffinityCheck,
  podDisruptionBudgetsCheck,
  resourceRequestsCheck,
  resourceLimitsCheck,
  livenessReadinessProbesCheck,
];

/**
 * Bootstrap the assessment check registry with built-in checks.
 * Validates all checks and fails fast on first invalid or duplicate.
 * Safe to call multiple times; duplicate registration will throw.
 */
export function bootstrapAssessmentRegistry(): void {
  const registry = getRegistry();
  registry.bootstrap(BUILT_IN_CHECKS);
}
