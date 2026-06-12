import type { AiConformanceChecklistDocument } from './contracts.js';

/**
 * Metadata recorded with every checklist selection and conformance run.
 */
export interface SelectedChecklistMetadata {
  checklistVersion: string;
  kubernetesMinor: string;
  sourceRevision: string;
  packageIdentifier: string;
  requirementCount: number;
}

/**
 * Loaded checklist with selection metadata for downstream evaluator and persistence.
 */
export interface LoadedChecklist {
  document: AiConformanceChecklistDocument;
  metadata: SelectedChecklistMetadata;
  sourcePath: string;
}

export interface ChecklistSelectionOptions {
  /**
   * Override detected Kubernetes minor for deterministic tests and CLI runs.
   */
  kubernetesMinorOverride?: string;
  /**
   * Optional checklist module root for tests (contains bundle-manifest.json and bundled/).
   */
  bundleRoot?: string;
}
