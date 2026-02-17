/**
 * Assessment Registry Bootstrap
 *
 * Wires initial built-in checks into the registry at startup.
 * Call bootstrapAssessmentRegistry() during operator initialization.
 */

import type { AssessmentCheck } from './types.js';
import { getRegistry } from './registry.js';

/** Built-in checks to register at bootstrap (extend as checks are implemented) */
const BUILT_IN_CHECKS: AssessmentCheck[] = [
  // Placeholder: add built-in checks here as they are implemented
  // e.g., security.pod-security-context, reliability.pod-disruption-budget, etc.
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
