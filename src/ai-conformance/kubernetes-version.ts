/**
 * Kubernetes version helpers for deterministic checklist selection.
 */

const KUBERNETES_MINOR_PATTERN = /^(\d+)\.(\d+)$/;

/**
 * Parse a Kubernetes minor version string (e.g. "1.31") from a gitVersion value.
 */
export function parseKubernetesMinorFromGitVersion(gitVersion: string): string | null {
  const trimmed = gitVersion.trim();
  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
  const core = withoutPrefix.split('+')[0]?.split('-')[0] ?? '';
  const parts = core.split('.');
  if (parts.length < 2) {
    return null;
  }

  const major = parts[0];
  const minor = parts[1];
  if (!/^\d+$/.test(major) || !/^\d+$/.test(minor)) {
    return null;
  }

  return `${major}.${minor}`;
}

/**
 * Normalize a Kubernetes minor override for tests and CLI usage.
 */
export function normalizeKubernetesMinor(minor: string): string {
  const trimmed = minor.trim();
  const normalized = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
  if (!KUBERNETES_MINOR_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid Kubernetes minor "${minor}". Expected format like "1.31".`
    );
  }
  return normalized;
}

/**
 * Build the bundled checklist filename for a Kubernetes minor.
 */
export function checklistFilenameForMinor(kubernetesMinor: string): string {
  const normalized = normalizeKubernetesMinor(kubernetesMinor);
  return `KubernetesAIConformance-${normalized}.yaml`;
}
