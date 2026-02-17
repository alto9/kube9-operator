/**
 * Assessment Check Registry
 *
 * Pluggable check registry with validation and query APIs.
 * Supports deterministic check discovery and filtering by pillar or id.
 * Invalid checks fail fast during bootstrap; duplicate IDs are blocked.
 */

import type { AssessmentCheck } from './types.js';
import { Pillar, isPillar } from './types.js';

/** Error thrown when a check with the same id is already registered */
export class DuplicateCheckIdError extends Error {
  constructor(
    public readonly checkId: string,
    message?: string,
  ) {
    super(message ?? `Duplicate check id: '${checkId}'. Each check must have a unique id.`);
    this.name = 'DuplicateCheckIdError';
  }
}

/** Error thrown when a check fails metadata validation */
export class InvalidCheckMetadataError extends Error {
  constructor(
    public readonly checkId: string,
    public readonly reason: string,
  ) {
    super(`Invalid check metadata for '${checkId}': ${reason}`);
    this.name = 'InvalidCheckMetadataError';
  }
}

/** Validation result for a single check */
export interface CheckValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that a check has complete required metadata.
 * Required: id (non-empty), name (non-empty), pillar (valid), run (function).
 */
export function validateCheck(check: AssessmentCheck): CheckValidationResult {
  const errors: string[] = [];

  if (typeof check.id !== 'string' || check.id.trim() === '') {
    errors.push('id must be a non-empty string');
  }

  if (typeof check.name !== 'string' || check.name.trim() === '') {
    errors.push('name must be a non-empty string');
  }

  if (!isPillar(check.pillar)) {
    errors.push(`pillar must be a valid Pillar enum value, got: ${String(check.pillar)}`);
  }

  if (typeof check.run !== 'function') {
    errors.push('run must be a function');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** In-memory check registry */
class CheckRegistry {
  private readonly checks = new Map<string, AssessmentCheck>();

  /**
   * Register a check. Throws if id is already registered or metadata is invalid.
   */
  register(check: AssessmentCheck): void {
    const validation = validateCheck(check);
    if (!validation.valid) {
      throw new InvalidCheckMetadataError(
        check.id || '<unknown>',
        validation.errors.join('; '),
      );
    }

    if (this.checks.has(check.id)) {
      throw new DuplicateCheckIdError(check.id);
    }

    this.checks.set(check.id, check);
  }

  /** List all registered checks (deterministic order by id) */
  getAllChecks(): AssessmentCheck[] {
    return Array.from(this.checks.values()).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }

  /** List checks for a given pillar (deterministic order by id) */
  getByPillar(pillar: Pillar): AssessmentCheck[] {
    return this.getAllChecks().filter((c) => c.pillar === pillar);
  }

  /** Get a single check by id */
  getById(id: string): AssessmentCheck | undefined {
    return this.checks.get(id);
  }

  /** Validate all checks and register them. Fails fast on first invalid or duplicate. */
  bootstrap(checks: AssessmentCheck[]): void {
    for (const check of checks) {
      this.register(check);
    }
  }

  /** Clear all registered checks (for testing) */
  clear(): void {
    this.checks.clear();
  }

  /** Number of registered checks */
  get size(): number {
    return this.checks.size;
  }
}

/** Singleton registry instance */
let registryInstance: CheckRegistry | null = null;

/**
 * Get the global check registry instance.
 * Creates one on first access.
 */
export function getRegistry(): CheckRegistry {
  if (registryInstance === null) {
    registryInstance = new CheckRegistry();
  }
  return registryInstance;
}

/**
 * Reset the global registry (for testing).
 * Use with caution in production.
 */
export function resetRegistry(): void {
  if (registryInstance !== null) {
    registryInstance.clear();
    registryInstance = null;
  }
}
