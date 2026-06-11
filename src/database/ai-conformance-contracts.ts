import { z } from 'zod';
import {
  AiConformanceRequirementLevelSchema,
  AiConformanceRequirementStatusSchema,
  AiConformanceRunStateSchema,
} from '../ai-conformance/contracts.js';

export const AiConformanceRunRecordSchema = z.object({
  run_id: z.string().min(1),
  checklist_version: z.string().min(1),
  kubernetes_minor: z.string().min(1),
  source_revision: z.string().nullable().optional(),
  state: AiConformanceRunStateSchema,
  requested_at: z.string().min(1),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  total_requirements: z.number().int().nonnegative(),
  must_requirements: z.number().int().nonnegative(),
  should_requirements: z.number().int().nonnegative(),
  passed_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  not_applicable_count: z.number().int().nonnegative(),
  not_evaluated_count: z.number().int().nonnegative(),
  needs_evidence_count: z.number().int().nonnegative(),
  failure_reason: z.string().nullable().optional(),
});

export const AiConformanceRequirementResultRecordSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  requirement_id: z.string().min(1),
  category: z.string().min(1),
  level: AiConformanceRequirementLevelSchema,
  title: z.string().min(1),
  status: AiConformanceRequirementStatusSchema,
  rationale: z.string().min(1),
  evidence_ref: z.string().nullable().optional(),
  evaluated_at: z.string().min(1),
});

export type AiConformanceRunRecord = z.infer<typeof AiConformanceRunRecordSchema>;
export type AiConformanceRequirementResultRecord = z.infer<
  typeof AiConformanceRequirementResultRecordSchema
>;
