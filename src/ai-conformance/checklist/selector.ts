import { checklistFilenameForMinor, normalizeKubernetesMinor } from '../kubernetes-version.js';
import type { LoadedChecklist, ChecklistSelectionOptions } from './types.js';
import { ChecklistLoadError } from './errors.js';
import { loadBundleManifest, loadChecklistFile } from './loader.js';

export interface ChecklistSelectionInput {
  /**
   * Cluster gitVersion when no override is provided.
   */
  gitVersion?: string | null;
  options?: ChecklistSelectionOptions;
}

/**
 * Resolve the Kubernetes minor used for checklist selection.
 */
export function resolveKubernetesMinorForSelection(
  input: ChecklistSelectionInput
): string {
  const override = input.options?.kubernetesMinorOverride;
  if (override !== undefined && override !== null && override !== '') {
    return normalizeKubernetesMinor(override);
  }

  const gitVersion = input.gitVersion?.trim();
  if (!gitVersion) {
    throw new ChecklistLoadError(
      'unsupported_minor',
      'Kubernetes minor is unavailable for checklist selection.'
    );
  }

  const withoutPrefix = gitVersion.startsWith('v') ? gitVersion.slice(1) : gitVersion;
  const core = withoutPrefix.split('+')[0]?.split('-')[0] ?? '';
  const parts = core.split('.');
  if (parts.length < 2 || !/^\d+$/.test(parts[0] ?? '') || !/^\d+$/.test(parts[1] ?? '')) {
    throw new ChecklistLoadError(
      'unsupported_minor',
      `Kubernetes version "${gitVersion}" does not include a supported minor.`,
      null
    );
  }

  return `${parts[0]}.${parts[1]}`;
}

/**
 * Select and load the bundled checklist for a Kubernetes minor.
 */
export function selectChecklistForCluster(
  input: ChecklistSelectionInput
): LoadedChecklist {
  const bundleRoot = input.options?.bundleRoot;
  const manifest = loadBundleManifest(bundleRoot);
  const kubernetesMinor = resolveKubernetesMinorForSelection(input);

  if (!manifest.supportedMinors.includes(kubernetesMinor)) {
    throw new ChecklistLoadError(
      'unsupported_minor',
      `Kubernetes minor ${kubernetesMinor} is not supported by the packaged checklist bundle.`,
      kubernetesMinor
    );
  }

  const filename = checklistFilenameForMinor(kubernetesMinor);
  const document = loadChecklistFile(filename, bundleRoot);

  if (document.kubernetesMinor !== kubernetesMinor) {
    throw new ChecklistLoadError(
      'invalid_checklist_document',
      `Checklist file ${filename} declares kubernetesMinor ${document.kubernetesMinor}, expected ${kubernetesMinor}.`,
      kubernetesMinor
    );
  }

  return {
    document,
    metadata: {
      checklistVersion: document.version,
      kubernetesMinor,
      sourceRevision: manifest.sourceRevision,
      packageIdentifier: manifest.packageIdentifier,
      requirementCount: document.requirements.length,
    },
    sourcePath: filename,
  };
}
