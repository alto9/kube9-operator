import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { ChecklistLoadError } from './errors.js';
import {
  loadBundleManifest,
  loadChecklistFile,
  parseChecklistYaml,
} from './loader.js';

function createTempBundleRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'kube9-checklist-'));
  const bundledDir = join(root, 'bundled');
  mkdirSync(bundledDir, { recursive: true });
  writeFileSync(
    join(root, 'bundle-manifest.json'),
    JSON.stringify({
      sourceRevision: 'test-revision',
      packageIdentifier: 'test-bundle',
      supportedMinors: ['1.31'],
    })
  );
  return root;
}

describe('checklist loader', () => {
  it('loads and validates the packaged bundle manifest', () => {
    const manifest = loadBundleManifest();
    expect(manifest.sourceRevision).toBe('bundle-2026.1');
    expect(manifest.supportedMinors).toContain('1.31');
  });

  it('loads a supported checklist file from the bundled directory', () => {
    const document = loadChecklistFile('KubernetesAIConformance-1.31.yaml');
    expect(document.version).toBe('KubernetesAIConformance-1.31');
    expect(document.kubernetesMinor).toBe('1.31');
    expect(document.requirements.length).toBeGreaterThan(0);
  });

  it('rejects malformed checklist YAML with bounded errors', () => {
    expect(() => parseChecklistYaml('version: [', 'test.yaml')).toThrow(ChecklistLoadError);
    expect(() => parseChecklistYaml('not-an-object', 'test.yaml')).toThrow(
      /expected a document object/
    );
  });

  it('rejects invalid checklist documents', () => {
    const invalid = `
version: KubernetesAIConformance-1.31
kubernetesMinor: "1.31"
title: Test
requirements: []
`;
    expect(() => parseChecklistYaml(invalid, 'invalid.yaml')).toThrow(
      ChecklistLoadError
    );
  });

  it('reports missing checklist files', () => {
    const bundleRoot = createTempBundleRoot();
    expect(() =>
      loadChecklistFile('KubernetesAIConformance-9.99.yaml', bundleRoot)
    ).toThrow(ChecklistLoadError);
  });
});
