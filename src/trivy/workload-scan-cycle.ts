/**
 * One pass: collect workload image references from the API, then optionally
 * run Trivy scans for each reference when Trivy integration is active.
 */

import type { KubernetesClient } from '../kubernetes/client.js';
import type { TrivyStatus } from '../status/types.js';
import { logger } from '../logging/logger.js';
import { collectWorkloadImageReferences } from './collect-workload-images.js';
import { scanContainerImageWhenDetected } from './scanner.js';
import { DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES } from './workload-images.js';
import { persistTrivyReportToDatabase, type PersistTrivyReportOptions } from './persist-scan-result.js';
import {
  recordImageScanDurationSeconds,
  refreshVulnerabilityMetrics,
  setScanningActiveGauge,
} from './metrics.js';

export interface WorkloadScanCycleOptions {
  kubernetesClient: KubernetesClient;
  getTrivyStatus: () => TrivyStatus;
  /** Max distinct normalized refs to collect (default: 10_000) */
  maxUniqueImages?: number;
  /** Max scans to run per cycle (default: 100) */
  maxScansPerCycle?: number;
  /** Override persistence (e.g. unit tests). Defaults to persistTrivyReportToDatabase. */
  persistTrivyReport?: (options: PersistTrivyReportOptions) => string;
}

export interface WorkloadScanCycleResult {
  /** True when Trivy was not active, so no scans were run (collection may still have run) */
  scansSkippedDueToTrivy: boolean;
  uniqueImagesCollected: number;
  truncated: boolean;
  scansAttempted: number;
  scansSucceeded: number;
  scansFailed: number;
}

function parseMaxScansPerCycle(): number {
  const raw = process.env.TRIVY_MAX_SCANS_PER_CYCLE;
  if (raw === undefined || raw === '') {
    return 100;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/**
 * Collects workload images from the API (no Trivy dependency), then feeds the list
 * into the Trivy CLI scan path only when Trivy is detected and available.
 */
export async function runWorkloadImageScanCycle(
  options: WorkloadScanCycleOptions
): Promise<WorkloadScanCycleResult> {
  const cycleStartMs = Date.now();
  const maxUnique = options.maxUniqueImages ?? DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES;
  const maxScans = options.maxScansPerCycle ?? parseMaxScansPerCycle();
  const persist = options.persistTrivyReport ?? persistTrivyReportToDatabase;

  const { images, truncated } = await collectWorkloadImageReferences(options.kubernetesClient, {
    maxUniqueImages: maxUnique,
  });

  const status = options.getTrivyStatus();
  setScanningActiveGauge(Boolean(status.detected && status.serverUrl));

  if (!status.detected || !status.serverUrl) {
    const cycleSeconds = (Date.now() - cycleStartMs) / 1000;
    recordImageScanDurationSeconds('skipped', cycleSeconds);
    refreshVulnerabilityMetrics();
    logger.info('Workload images collected; skipping Trivy scans (integration not active)', {
      uniqueImagesCollected: images.length,
      truncated,
    });
    return {
      scansSkippedDueToTrivy: true,
      uniqueImagesCollected: images.length,
      truncated,
      scansAttempted: 0,
      scansSucceeded: 0,
      scansFailed: 0,
    };
  }

  const toScan = images.slice(0, maxScans);
  if (images.length > maxScans) {
    logger.info('Workload image scan cycle limiting scans per cycle', {
      totalUnique: images.length,
      maxScansPerCycle: maxScans,
    });
  }

  let scansSucceeded = 0;
  let scansFailed = 0;

  for (const imageRef of toScan) {
    const scanStart = Date.now();
    try {
      const report = await scanContainerImageWhenDetected(imageRef, {
        getStatus: options.getTrivyStatus,
      });
      persist({ imageRef, report });
      scansSucceeded++;
      recordImageScanDurationSeconds('success', (Date.now() - scanStart) / 1000);
    } catch (err) {
      scansFailed++;
      recordImageScanDurationSeconds('failed', (Date.now() - scanStart) / 1000);
      logger.warn('Trivy scan failed for workload image', {
        imageRef,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  refreshVulnerabilityMetrics();

  if (truncated) {
    logger.warn('Workload image collection hit unique image cap', {
      maxUniqueImages: maxUnique,
    });
  }

  logger.info('Workload image scan cycle completed', {
    uniqueImagesCollected: images.length,
    truncated,
    scansAttempted: toScan.length,
    scansSucceeded,
    scansFailed,
  });

  return {
    scansSkippedDueToTrivy: false,
    uniqueImagesCollected: images.length,
    truncated,
    scansAttempted: toScan.length,
    scansSucceeded,
    scansFailed,
  };
}
