import { z } from 'zod';

export const AiConformanceRequirementLevelSchema = z.enum(['MUST', 'SHOULD']);

export const AiConformanceChecklistRequirementSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  level: AiConformanceRequirementLevelSchema,
  title: z.string().min(1),
  description: z.string().min(1),
});

export const AiConformanceChecklistDocumentSchema = z.object({
  version: z.string().min(1),
  kubernetesMinor: z.string().regex(/^\d+\.\d+$/),
  title: z.string().min(1),
  requirements: z.array(AiConformanceChecklistRequirementSchema).min(1),
});

export const AiConformanceBundleManifestSchema = z.object({
  sourceRevision: z.string().min(1),
  packageIdentifier: z.string().min(1),
  supportedMinors: z.array(z.string().regex(/^\d+\.\d+$/)).min(1),
});

export type AiConformanceChecklistRequirement = z.infer<
  typeof AiConformanceChecklistRequirementSchema
>;
export type AiConformanceChecklistDocument = z.infer<
  typeof AiConformanceChecklistDocumentSchema
>;
export type AiConformanceBundleManifest = z.infer<
  typeof AiConformanceBundleManifestSchema
>;
