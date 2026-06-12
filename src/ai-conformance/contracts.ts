import { z } from 'zod';

export const AiConformanceRunStateSchema = z.enum(['completed', 'failed', 'partial']);

export const AiConformanceRequirementStatusSchema = z.enum([
  'passed',
  'failed',
  'warning',
  'not-applicable',
  'not-evaluated',
  'needs-evidence',
]);

export const AiConformanceRequirementLevelSchema = z.enum(['MUST', 'SHOULD']);

export const AiConformanceTotalsSchema = z.object({
  totalRequirements: z.number().int().nonnegative(),
  mustRequirements: z.number().int().nonnegative(),
  shouldRequirements: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  warning: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  notEvaluated: z.number().int().nonnegative(),
  needsEvidence: z.number().int().nonnegative(),
});

export const AiConformanceCategorySummarySchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  warning: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  notEvaluated: z.number().int().nonnegative(),
  needsEvidence: z.number().int().nonnegative(),
});

export const AiConformanceRequirementSummarySchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  level: AiConformanceRequirementLevelSchema,
  title: z.string().min(1),
  status: AiConformanceRequirementStatusSchema,
  rationale: z.string().min(1),
  evidenceRef: z.string().nullable().optional(),
});

export const AiConformanceLatestSummarySchema = z.object({
  checklistVersion: z.string().min(1),
  kubernetesMinor: z.string().min(1),
  sourceRevision: z.string().nullable(),
  lastCompletedAt: z.string().nullable(),
  lastOutcome: z.enum(['none', 'success', 'failed']),
  runState: AiConformanceRunStateSchema.nullable(),
  runId: z.string().nullable(),
  totals: AiConformanceTotalsSchema,
  categories: z.record(z.string(), AiConformanceCategorySummarySchema),
  requirements: z.array(AiConformanceRequirementSummarySchema),
  error: z.string().nullable(),
});

export const EvaluatedRequirementResultSchema = z.object({
  requirement_id: z.string().min(1),
  category: z.string().min(1),
  level: AiConformanceRequirementLevelSchema,
  title: z.string().min(1),
  status: AiConformanceRequirementStatusSchema,
  rationale: z.string().min(1),
  evidence_ref: z.string().nullable().optional(),
  evaluated_at: z.string().min(1),
});

export type AiConformanceRunState = z.infer<typeof AiConformanceRunStateSchema>;
export type AiConformanceRequirementStatus = z.infer<
  typeof AiConformanceRequirementStatusSchema
>;
export type AiConformanceRequirementLevel = z.infer<typeof AiConformanceRequirementLevelSchema>;
export type AiConformanceTotals = z.infer<typeof AiConformanceTotalsSchema>;
export type AiConformanceCategorySummary = z.infer<typeof AiConformanceCategorySummarySchema>;
export type AiConformanceRequirementSummary = z.infer<
  typeof AiConformanceRequirementSummarySchema
>;
export type AiConformanceLatestSummary = z.infer<typeof AiConformanceLatestSummarySchema>;
export type EvaluatedRequirementResult = z.infer<typeof EvaluatedRequirementResultSchema>;

/** Unicode-safe length cap for status JSON fields. */
export const CONFORMANCE_STATUS_FIELD_MAX = 420;

/** Bounded failure reason for persisted runs. */
export const CONFORMANCE_FAILURE_REASON_MAX = 120;

export function boundConformanceText(
  value: string,
  maxLength: number = CONFORMANCE_STATUS_FIELD_MAX
): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
}
