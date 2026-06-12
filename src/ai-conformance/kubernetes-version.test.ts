import { describe, expect, it } from 'vitest';
import {
  checklistFilenameForMinor,
  normalizeKubernetesMinor,
  parseKubernetesMinorFromGitVersion,
} from './kubernetes-version.js';

describe('kubernetes-version', () => {
  it('parses Kubernetes minor from common gitVersion formats', () => {
    expect(parseKubernetesMinorFromGitVersion('v1.31.2')).toBe('1.31');
    expect(parseKubernetesMinorFromGitVersion('1.32.0')).toBe('1.32');
    expect(parseKubernetesMinorFromGitVersion('v1.30.5-gke.123')).toBe('1.30');
    expect(parseKubernetesMinorFromGitVersion('v1.29.0+build')).toBe('1.29');
  });

  it('returns null for unsupported gitVersion values', () => {
    expect(parseKubernetesMinorFromGitVersion('')).toBeNull();
    expect(parseKubernetesMinorFromGitVersion('unknown')).toBeNull();
    expect(parseKubernetesMinorFromGitVersion('v1')).toBeNull();
  });

  it('normalizes Kubernetes minor overrides', () => {
    expect(normalizeKubernetesMinor('v1.31')).toBe('1.31');
    expect(normalizeKubernetesMinor('1.32')).toBe('1.32');
    expect(() => normalizeKubernetesMinor('1')).toThrow(/Invalid Kubernetes minor/);
  });

  it('builds checklist filenames from Kubernetes minor', () => {
    expect(checklistFilenameForMinor('1.31')).toBe('KubernetesAIConformance-1.31.yaml');
    expect(checklistFilenameForMinor('v1.32')).toBe('KubernetesAIConformance-1.32.yaml');
  });
});
