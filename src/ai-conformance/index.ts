export {
  parseKubernetesMinorFromGitVersion,
  normalizeKubernetesMinor,
  checklistFilenameForMinor,
} from './kubernetes-version.js';

export {
  AiConformanceRequirementLevelSchema,
  AiConformanceChecklistRequirementSchema,
  AiConformanceChecklistDocumentSchema,
  AiConformanceBundleManifestSchema,
} from './checklist/contracts.js';
export type {
  AiConformanceChecklistRequirement,
  AiConformanceChecklistDocument,
  AiConformanceBundleManifest,
} from './checklist/contracts.js';

export {
  ChecklistLoadError,
  boundChecklistErrorDetail,
} from './checklist/errors.js';
export type { ChecklistErrorCode } from './checklist/errors.js';

export type {
  SelectedChecklistMetadata,
  LoadedChecklist,
  ChecklistSelectionOptions,
} from './checklist/types.js';

export {
  loadBundleManifest,
  parseChecklistYaml,
  loadChecklistFile,
} from './checklist/loader.js';

export {
  resolveKubernetesMinorForSelection,
  selectChecklistForCluster,
} from './checklist/selector.js';
export type { ChecklistSelectionInput } from './checklist/selector.js';

export {
  AiConformanceRunStateSchema,
  AiConformanceRequirementStatusSchema,
  AiConformanceTotalsSchema,
  AiConformanceCategorySummarySchema,
  AiConformanceRequirementSummarySchema,
  AiConformanceLatestSummarySchema,
  EvaluatedRequirementResultSchema,
  boundConformanceText,
  CONFORMANCE_STATUS_FIELD_MAX,
  CONFORMANCE_FAILURE_REASON_MAX,
} from './contracts.js';
export type {
  AiConformanceRunState,
  AiConformanceRequirementStatus,
  AiConformanceTotals,
  AiConformanceCategorySummary,
  AiConformanceRequirementSummary,
  AiConformanceLatestSummary,
  EvaluatedRequirementResult,
} from './contracts.js';

export {
  evaluateRequirement,
  evaluateChecklistRequirements,
} from './evaluator.js';
export type {
  AiConformanceEvaluatorContext,
  RequirementEvaluator,
} from './evaluator.js';

export { AiConformanceRunner } from './runner.js';
export type { AiConformanceRunInput, AiConformanceRunnerDeps } from './runner.js';

export {
  buildTotalsFromResults,
  buildCategoryRollups,
  buildBoundedRequirementSummaries,
} from './summary.js';
