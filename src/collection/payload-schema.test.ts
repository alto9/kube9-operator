import { describe, it, expect } from 'vitest';
import { CollectionPayloadSchema } from './payload-schema.js';
import type { CollectionPayload } from './types.js';

const ts = '2026-08-03T12:00:00.000Z';

function baseEnvelope(type: CollectionPayload['type'], data: unknown): CollectionPayload {
  return {
    version: 'v1.0.0',
    type,
    data: data as CollectionPayload['data'],
    sanitization: {
      rulesApplied: ['hash-identifiers'],
      timestamp: ts,
    },
  };
}

function validPerformanceMetricsData(): Record<string, unknown> {
  return {
    timestamp: ts,
    collectionId: 'coll_perf123456789012345678901234',
    clusterId: 'cls_testabc1234567890123456789012',
    source: { available: true },
    utilization: {
      cpu: { clusterAvgRatio: 0.42, nodeHighWatermarkRatio: 0.88 },
      memory: { clusterAvgRatio: 0.55 },
    },
    ratios: { pending_pods_ratio: 0.1 },
  };
}

function validSecurityPostureData(): Record<string, unknown> {
  return {
    timestamp: ts,
    collectionId: 'coll_sec1234567890123456789012345',
    clusterId: 'cls_testabc1234567890123456789012',
    privilegedHost: {
      privilegedContainers: 2,
      hostPathVolumes: 1,
      hostNetworkPods: 0,
      hostPIDPods: 1,
      hostIPCPods: 0,
    },
    networkPolicyCoverage: {
      namespacesTotal: 10,
      namespacesWithNetworkPolicy: 7,
      coverageRatio: 0.7,
    },
    nsaCisRollups: {
      allowPrivilegeEscalationTrueContainers: 3,
      runAsNonRootFalseContainers: 5,
      readOnlyRootFilesystemFalseContainers: 8,
      capabilitiesNotDroppedAllContainers: 2,
      automountServiceAccountTokenTruePods: 4,
      hostNamespacesPods: 1,
    },
  };
}

describe('CollectionPayloadSchema', () => {
  it('accepts valid performance-metrics payload', () => {
    const payload = baseEnvelope('performance-metrics', validPerformanceMetricsData());
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts valid security-posture payload', () => {
    const payload = baseEnvelope('security-posture', validSecurityPostureData());
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects performance-metrics type/data mismatch', () => {
    const payload = baseEnvelope('performance-metrics', validSecurityPostureData() as never);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects security-posture type/data mismatch', () => {
    const payload = baseEnvelope('security-posture', validPerformanceMetricsData() as never);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects performance-metrics data larger than 64 KiB', () => {
    const data = validPerformanceMetricsData();
    data.collectionId = `coll_${'a'.repeat(65500)}`;

    const payload = baseEnvelope('performance-metrics', data);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects security-posture vulnerabilities-shaped body', () => {
    const data = {
      ...validSecurityPostureData(),
      vulnerabilities: [{ id: 'CVE-2024-0001' }],
    };
    const payload = baseEnvelope('security-posture', data);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects security-posture unknown nsaCisRollups keys', () => {
    const base = validSecurityPostureData();
    const data = {
      ...base,
      nsaCisRollups: {
        ...(base.nsaCisRollups as Record<string, number>),
        extraRollup: 1,
      },
    };
    const payload = baseEnvelope('security-posture', data);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects performance-metrics ratios with more than 16 keys', () => {
    const data = validPerformanceMetricsData();
    const ratios: Record<string, number> = Object.fromEntries(
      Array.from({ length: 17 }, (_, i) => [`key_${i}`, 0.1])
    );
    data.ratios = ratios;
    const payload = baseEnvelope('performance-metrics', data);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects performance-metrics ratio outside [0, 1]', () => {
    const data = validPerformanceMetricsData();
    data.utilization = { cpu: { clusterAvgRatio: 1.5 } };
    const payload = baseEnvelope('performance-metrics', data);
    expect(CollectionPayloadSchema.safeParse(payload).success).toBe(false);
  });
});
