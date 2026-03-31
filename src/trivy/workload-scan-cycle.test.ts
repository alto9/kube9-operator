import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runWorkloadImageScanCycle } from './workload-scan-cycle.js';
import type { KubernetesClient } from '../kubernetes/client.js';
import type { TrivyStatus } from '../status/types.js';
import * as collectMod from './collect-workload-images.js';
import * as scannerMod from './scanner.js';

describe('runWorkloadImageScanCycle', () => {
  const client = {} as KubernetesClient;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.TRIVY_MAX_SCANS_PER_CYCLE;
  });

  it('collects but skips scans when Trivy is not detected', async () => {
    vi.spyOn(collectMod, 'collectWorkloadImageReferences').mockResolvedValue({
      images: ['a:1'],
      truncated: false,
    });
    const scanSpy = vi.spyOn(scannerMod, 'scanContainerImageWhenDetected');

    const getTrivyStatus = (): TrivyStatus => ({
      detected: false,
      serverUrl: null,
      version: null,
      lastChecked: new Date().toISOString(),
    });

    const r = await runWorkloadImageScanCycle({
      kubernetesClient: client,
      getTrivyStatus,
      persistTrivyReport: () => 'noop',
    });
    expect(r.scansSkippedDueToTrivy).toBe(true);
    expect(r.uniqueImagesCollected).toBe(1);
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('collects and scans when Trivy is detected', async () => {
    vi.spyOn(collectMod, 'collectWorkloadImageReferences').mockResolvedValue({
      images: ['alpine:3', 'busybox:1'],
      truncated: false,
    });
    const scanSpy = vi.spyOn(scannerMod, 'scanContainerImageWhenDetected').mockResolvedValue({});

    const getTrivyStatus = (): TrivyStatus => ({
      detected: true,
      serverUrl: 'http://trivy:4954',
      version: '1',
      lastChecked: new Date().toISOString(),
    });

    const r = await runWorkloadImageScanCycle({
      kubernetesClient: client,
      getTrivyStatus,
      maxScansPerCycle: 10,
      persistTrivyReport: () => 'noop',
    });

    expect(r.scansSkippedDueToTrivy).toBe(false);
    expect(r.uniqueImagesCollected).toBe(2);
    expect(r.scansAttempted).toBe(2);
    expect(r.scansSucceeded).toBe(2);
    expect(scanSpy).toHaveBeenCalledTimes(2);
  });

  it('continues after a failed scan', async () => {
    vi.spyOn(collectMod, 'collectWorkloadImageReferences').mockResolvedValue({
      images: ['a:1', 'b:2'],
      truncated: false,
    });
    const scanSpy = vi
      .spyOn(scannerMod, 'scanContainerImageWhenDetected')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({});

    const getTrivyStatus = (): TrivyStatus => ({
      detected: true,
      serverUrl: 'http://trivy:4954',
      version: '1',
      lastChecked: new Date().toISOString(),
    });

    const r = await runWorkloadImageScanCycle({
      kubernetesClient: client,
      getTrivyStatus,
      maxScansPerCycle: 10,
      persistTrivyReport: () => 'noop',
    });

    expect(r.scansFailed).toBe(1);
    expect(r.scansSucceeded).toBe(1);
    expect(scanSpy).toHaveBeenCalledTimes(2);
  });
});
