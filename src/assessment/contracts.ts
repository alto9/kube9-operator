import { z } from 'zod';

export const AssessmentPillarSchema = z.enum([
  'security',
  'reliability',
  'performance-efficiency',
  'cost-optimization',
  'operational-excellence',
  'sustainability',
]);

export const AssessmentLifecycleStateSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'partial',
]);

export const AssessmentRunModeSchema = z.enum([
  'full',
  'pillar',
  'single-check',
]);

export const AssessmentCheckStatusSchema = z.enum([
  'passing',
  'failing',
  'warning',
  'skipped',
  'error',
  'timeout',
]);

export const AssessmentCheckMetadataSchema = z.object({
  check_id: z.string().min(1),
  name: z.string().min(1),
  pillar: AssessmentPillarSchema,
  description: z.string().min(1),
  timeout_ms: z.number().int().positive().max(300000),
  owner_module: z.string().min(1),
});

export const AssessmentRunRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('full'),
    request_id: z.string().min(1),
    initiated_by: z.enum(['scheduler', 'cli']),
  }),
  z.object({
    mode: z.literal('pillar'),
    request_id: z.string().min(1),
    initiated_by: z.enum(['scheduler', 'cli']),
    pillar: AssessmentPillarSchema,
  }),
  z.object({
    mode: z.literal('single-check'),
    request_id: z.string().min(1),
    initiated_by: z.enum(['scheduler', 'cli']),
    check_id: z.string().min(1),
  }),
]);

export const RunnerRegistryQuerySchema = z.object({
  mode: AssessmentRunModeSchema,
  pillar: AssessmentPillarSchema.optional(),
  check_id: z.string().optional(),
});

export const RegistryResolutionSchema = z.object({
  checks: z.array(AssessmentCheckMetadataSchema),
});

export const AssessmentCheckResultSchema = z.object({
  run_id: z.string().min(1),
  check_id: z.string().min(1),
  pillar: AssessmentPillarSchema,
  status: AssessmentCheckStatusSchema,
  message: z.string().min(1),
  remediation: z.string().optional(),
  duration_ms: z.number().int().nonnegative(),
  assessed_at: z.string().datetime(),
  error_code: z.string().optional(),
});

export const AssessmentRunRecordSchema = z.object({
  run_id: z.string().min(1),
  mode: AssessmentRunModeSchema,
  state: AssessmentLifecycleStateSchema,
  requested_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  total_checks: z.number().int().nonnegative(),
  completed_checks: z.number().int().nonnegative(),
  passed_checks: z.number().int().nonnegative(),
  failed_checks: z.number().int().nonnegative(),
  warning_checks: z.number().int().nonnegative(),
  skipped_checks: z.number().int().nonnegative(),
  error_checks: z.number().int().nonnegative(),
  timeout_checks: z.number().int().nonnegative(),
  failure_reason: z.string().optional(),
});

const validTransitions: Record<AssessmentLifecycleState, AssessmentLifecycleState[]> = {
  queued: ['running', 'failed'],
  running: ['completed', 'partial', 'failed'],
  completed: [],
  partial: [],
  failed: [],
};

export function canTransitionAssessmentState(
  from: AssessmentLifecycleState,
  to: AssessmentLifecycleState,
): boolean {
  return validTransitions[from].includes(to);
}

export type AssessmentPillar = z.infer<typeof AssessmentPillarSchema>;
export type AssessmentLifecycleState = z.infer<typeof AssessmentLifecycleStateSchema>;
export type AssessmentRunMode = z.infer<typeof AssessmentRunModeSchema>;
export type AssessmentCheckStatus = z.infer<typeof AssessmentCheckStatusSchema>;
export type AssessmentCheckMetadata = z.infer<typeof AssessmentCheckMetadataSchema>;
export type AssessmentRunRequest = z.infer<typeof AssessmentRunRequestSchema>;
export type RunnerRegistryQuery = z.infer<typeof RunnerRegistryQuerySchema>;
export type RegistryResolution = z.infer<typeof RegistryResolutionSchema>;
export type AssessmentCheckResult = z.infer<typeof AssessmentCheckResultSchema>;
export type AssessmentRunRecord = z.infer<typeof AssessmentRunRecordSchema>;
