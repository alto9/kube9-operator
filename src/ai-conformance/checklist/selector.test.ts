import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { boundChecklistErrorDetail, ChecklistLoadError } from './errors.js';
import {
  resolveKubernetesMinorForSelection,
  selectChecklistForCluster,
} from './selector.js';

function writeValidChecklist(bundleRoot: string, minor: string): void {
  const bundledDir = join(bundleRoot, 'bundled');
  mkdirSync(bundledDir, { recursive: true });
  writeFileSync(
    join(bundleRoot, 'bundle-manifest.json'),
    JSON.stringify({
      sourceRevision: 'test-revision',
      packageIdentifier: 'test-bundle',
      supportedMinors: [minor],
    })
  );
  writeFileSync(
    join(bundledDir, `KubernetesAIConformance-${minor}.yaml`),
    `version: KubernetesAIConformance-${minor}
kubernetesMinor: "${minor}"
title: Test Checklist
requirements:
  - id: security.example
    category: security
    level: MUST
    title: Example requirement
    description: Example description for tests.
`
  );
}

describe('checklist selector', () => {
  it('selects a supported checklist by detected Kubernetes minor', () => {
    const loaded = selectChecklistForCluster({ gitVersion: 'v1.31.4' });
    expect(loaded.metadata.checklistVersion).toBe('KubernetesAIConformance-1.31');
    expect(loaded.metadata.kubernetesMinor).toBe('1.31');
    expect(loaded.metadata.sourceRevision).toBe('bundle-2026.1');
    expect(loaded.metadata.requirementCount).toBe(loaded.document.requirements.length);
  });

  it('supports kubernetesMinor override for deterministic tests', () => {
    const loaded = selectChecklistForCluster({
      gitVersion: 'v9.99.0',
      options: { kubernetesMinorOverride: '1.32' },
    });
    expect(loaded.metadata.kubernetesMinor).toBe('1.32');
    expect(loaded.metadata.checklistVersion).toBe('KubernetesAIConformance-1.32');
  });

  it('rejects unsupported Kubernetes minors', () => {
    expect(() =>
      selectChecklistForCluster({
        gitVersion: 'v1.29.0',
      })
    ).toThrow(ChecklistLoadError);

    try {
      selectChecklistForCluster({ gitVersion: 'v1.29.0' });
    } catch (error) {
      expect(error).toBeInstanceOf(ChecklistLoadError);
      if (error instanceof ChecklistLoadError) {
        expect(error.code).toBe('unsupported_minor');
        expect(error.kubernetesMinor).toBe('1.29');
        expect(boundChecklistErrorDetail(error)).toContain('unsupported_minor');
      }
    }
  });

  it('rejects malformed checklist YAML from a custom bundle root', () => {
    const bundleRoot = mkdtempSync(join(tmpdir(), 'kube9-checklist-bad-'));
    const bundledDir = join(bundleRoot, 'bundled');
    mkdirSync(bundledDir, { recursive: true });
    writeFileSync(
      join(bundleRoot, 'bundle-manifest.json'),
      JSON.stringify({
        sourceRevision: 'bad-revision',
        packageIdentifier: 'bad-bundle',
        supportedMinors: ['1.31'],
      })
    );
    writeFileSync(join(bundledDir, 'KubernetesAIConformance-1.31.yaml'), 'version: [');

    expect(() =>
      selectChecklistForCluster({
        options: {
          kubernetesMinorOverride: '1.31',
          bundleRoot,
        },
      })
    ).toThrow(ChecklistLoadError);
  });

  it('propagates source revision from bundle manifest', () => {
    const bundleRoot = mkdtempSync(join(tmpdir(), 'kube9-checklist-rev-'));
    writeValidChecklist(bundleRoot, '1.30');
    const loaded = selectChecklistForCluster({
      options: {
        kubernetesMinorOverride: '1.30',
        bundleRoot,
      },
    });
    expect(loaded.metadata.sourceRevision).toBe('test-revision');
    expect(loaded.metadata.packageIdentifier).toBe('test-bundle');
  });

  it('resolves Kubernetes minor from override before gitVersion', () => {
    expect(
      resolveKubernetesMinorForSelection({
        gitVersion: 'v1.31.0',
        options: { kubernetesMinorOverride: '1.32' },
      })
    ).toBe('1.32');
  });
});
