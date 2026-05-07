import { z } from 'zod';

/**
 * Normalized Argo CD Application status payload produced by the M9 collector (#55).
 * Stored as JSON in `argocd_apps.status_json`; kept flexible until the collector contract stabilizes.
 */
export const ArgoCdAppStatusPayloadSchema = z.record(z.string(), z.unknown());

/** Optional drift classification JSON for #56. */
export const ArgoCdAppDriftPayloadSchema = z.record(z.string(), z.unknown());

export const ArgoCdAppUpsertSchema = z.object({
  cluster_id: z.string().min(1),
  app_namespace: z.string().min(1),
  app_name: z.string().min(1),
  observed_at: z.string().min(1),
  status_json: ArgoCdAppStatusPayloadSchema,
  drift_json: ArgoCdAppDriftPayloadSchema.optional().nullable(),
});

export type ArgoCdAppUpsert = z.infer<typeof ArgoCdAppUpsertSchema>;
