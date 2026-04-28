import type { Config } from './types.js';
import { logger } from '../logging/logger.js';
import { isPillar } from '../assessment/types.js';

const ASSESSMENT_MODES = ['full', 'pillar', 'single-check'] as const;
type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

const ASSESSMENT_INTERVAL_MIN_SECONDS = 3600;
const ASSESSMENT_TIMEOUT_MIN_SECONDS = 60;
const ASSESSMENT_TIMEOUT_MAX_SECONDS = 7 * 24 * 3600;
/** Matches operator scheduler minimum for `resource-inventory` (30 minutes). */
const RESOURCE_INVENTORY_INTERVAL_MIN_SECONDS = 1800;

/**
 * Parses a positive base-10 integer from env or a default string.
 * Rejects NaN and values below `minInclusive` so misconfigured Helm/env fails fast at startup.
 */
function parsePositiveInt(
  envName: string,
  raw: string | undefined,
  defaultValue: string,
  minInclusive: number = 1
): number {
  const s = raw !== undefined && raw !== '' ? raw : defaultValue;
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n < minInclusive) {
    throw new Error(
      `${envName} must be an integer >= ${minInclusive}${raw !== undefined && raw !== '' ? ` (got "${raw}")` : ''}`
    );
  }
  return n;
}

function parseEnvBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(v)) {
    return false;
  }
  throw new Error(
    `Invalid boolean for ASSESSMENT_ENABLED: "${raw}" (use true/false, 1/0, yes/no)`
  );
}

function parseAssessmentMode(raw: string | undefined): AssessmentMode {
  const v = (raw ?? 'full').trim().toLowerCase();
  if ((ASSESSMENT_MODES as readonly string[]).includes(v)) {
    return v as AssessmentMode;
  }
  throw new Error(
    `ASSESSMENT_MODE must be one of ${ASSESSMENT_MODES.join(', ')}; got "${raw ?? ''}"`
  );
}

/**
 * Load configuration from environment variables
 *
 * @returns Promise resolving to Config object
 */
export async function loadConfig(): Promise<Config> {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const statusUpdateIntervalSeconds = parsePositiveInt(
    'STATUS_UPDATE_INTERVAL_SECONDS',
    process.env.STATUS_UPDATE_INTERVAL_SECONDS,
    '60'
  );
  const clusterMetadataIntervalSeconds = parsePositiveInt(
    'CLUSTER_METADATA_INTERVAL_SECONDS',
    process.env.CLUSTER_METADATA_INTERVAL_SECONDS,
    '86400'
  );
  const resourceInventoryIntervalSeconds = parsePositiveInt(
    'RESOURCE_INVENTORY_INTERVAL_SECONDS',
    process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS,
    '21600',
    RESOURCE_INVENTORY_INTERVAL_MIN_SECONDS
  );
  const resourceConfigurationPatternsIntervalSeconds = parsePositiveInt(
    'RESOURCE_CONFIGURATION_PATTERNS_INTERVAL_SECONDS',
    process.env.RESOURCE_CONFIGURATION_PATTERNS_INTERVAL_SECONDS,
    '43200'
  );
  const workloadImageScanIntervalSeconds = parsePositiveInt(
    'WORKLOAD_IMAGE_SCAN_INTERVAL_SECONDS',
    process.env.WORKLOAD_IMAGE_SCAN_INTERVAL_SECONDS,
    '86400'
  );
  const eventRetentionInfoWarningDays = parsePositiveInt(
    'EVENT_RETENTION_INFO_WARNING_DAYS',
    process.env.EVENT_RETENTION_INFO_WARNING_DAYS,
    '7'
  );
  const eventRetentionErrorCriticalDays = parsePositiveInt(
    'EVENT_RETENTION_ERROR_CRITICAL_DAYS',
    process.env.EVENT_RETENTION_ERROR_CRITICAL_DAYS,
    '30'
  );
  const assessmentEnabled = parseEnvBool(process.env.ASSESSMENT_ENABLED, false);
  const assessmentIntervalSeconds = parsePositiveInt(
    'ASSESSMENT_INTERVAL_SECONDS',
    process.env.ASSESSMENT_INTERVAL_SECONDS,
    '86400',
    ASSESSMENT_INTERVAL_MIN_SECONDS
  );
  const assessmentMode = parseAssessmentMode(process.env.ASSESSMENT_MODE);
  const assessmentTimeoutRaw = process.env.ASSESSMENT_TIMEOUT_SECONDS;
  let assessmentTimeoutSeconds: number | undefined;
  if (assessmentTimeoutRaw !== undefined && assessmentTimeoutRaw !== '') {
    assessmentTimeoutSeconds = parseInt(assessmentTimeoutRaw, 10);
    if (
      Number.isNaN(assessmentTimeoutSeconds) ||
      assessmentTimeoutSeconds < ASSESSMENT_TIMEOUT_MIN_SECONDS ||
      assessmentTimeoutSeconds > ASSESSMENT_TIMEOUT_MAX_SECONDS
    ) {
      throw new Error(
        `ASSESSMENT_TIMEOUT_SECONDS must be an integer between ${ASSESSMENT_TIMEOUT_MIN_SECONDS} and ${ASSESSMENT_TIMEOUT_MAX_SECONDS}`
      );
    }
  }

  if (assessmentEnabled && assessmentMode === 'single-check') {
    throw new Error(
      'ASSESSMENT_MODE cannot be "single-check" for scheduled assessments (no check id context)'
    );
  }

  let assessmentPillar: string | undefined;
  if (assessmentEnabled && assessmentMode === 'pillar') {
    const raw = process.env.ASSESSMENT_PILLAR?.trim();
    if (!raw) {
      throw new Error(
        'ASSESSMENT_PILLAR is required when ASSESSMENT_ENABLED=true and ASSESSMENT_MODE=pillar'
      );
    }
    if (!isPillar(raw)) {
      throw new Error(
        `Invalid ASSESSMENT_PILLAR "${raw}" (must be a Well-Architected pillar id)`
      );
    }
    assessmentPillar = raw;
  }

  const config: Config = {
    logLevel,
    statusUpdateIntervalSeconds,
    clusterMetadataIntervalSeconds,
    resourceInventoryIntervalSeconds,
    resourceConfigurationPatternsIntervalSeconds,
    workloadImageScanIntervalSeconds,
    eventRetentionInfoWarningDays,
    eventRetentionErrorCriticalDays,
    assessmentEnabled,
    assessmentIntervalSeconds,
    assessmentMode,
    ...(assessmentPillar !== undefined ? { assessmentPillar } : {}),
    ...(assessmentTimeoutSeconds !== undefined
      ? { assessmentTimeoutSeconds }
      : {}),
  };

  logger.info('Collection intervals configured', {
    clusterMetadataIntervalSeconds: config.clusterMetadataIntervalSeconds,
    resourceInventoryIntervalSeconds: config.resourceInventoryIntervalSeconds,
    resourceConfigurationPatternsIntervalSeconds: config.resourceConfigurationPatternsIntervalSeconds,
    clusterMetadataOverridden: process.env.CLUSTER_METADATA_INTERVAL_SECONDS !== undefined,
    resourceInventoryOverridden: process.env.RESOURCE_INVENTORY_INTERVAL_SECONDS !== undefined,
    resourceConfigurationPatternsOverridden: process.env.RESOURCE_CONFIGURATION_PATTERNS_INTERVAL_SECONDS !== undefined,
    workloadImageScanIntervalSeconds: config.workloadImageScanIntervalSeconds,
    workloadImageScanOverridden: process.env.WORKLOAD_IMAGE_SCAN_INTERVAL_SECONDS !== undefined,
  });

  logger.info('Assessment schedule configured', {
    assessmentEnabled: config.assessmentEnabled,
    assessmentIntervalSeconds: config.assessmentIntervalSeconds,
    assessmentMode: config.assessmentMode,
    assessmentPillar: config.assessmentPillar ?? null,
    assessmentTimeoutSeconds: config.assessmentTimeoutSeconds ?? null,
    assessmentEnabledOverridden: process.env.ASSESSMENT_ENABLED !== undefined,
    assessmentIntervalOverridden: process.env.ASSESSMENT_INTERVAL_SECONDS !== undefined,
    assessmentModeOverridden: process.env.ASSESSMENT_MODE !== undefined,
    assessmentPillarOverridden: process.env.ASSESSMENT_PILLAR !== undefined,
    assessmentTimeoutOverridden: process.env.ASSESSMENT_TIMEOUT_SECONDS !== undefined,
  });

  return config;
}

/**
 * Singleton config instance
 * Loaded once at startup
 */
let configInstance: Config | null = null;

/**
 * Get the loaded configuration singleton
 *
 * @returns Config instance
 * @throws Error if config has not been loaded yet
 */
export function getConfig(): Config {
  if (configInstance === null) {
    throw new Error('Config has not been loaded yet. Call loadConfig() first.');
  }
  return configInstance;
}

/**
 * Set the config instance (used after loading)
 *
 * @param config - The loaded configuration
 */
export function setConfig(config: Config): void {
  configInstance = config;
}
