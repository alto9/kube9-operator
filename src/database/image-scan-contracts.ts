import { z } from 'zod';

export const ImageScanStateSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export const ImageScanRecordSchema = z.object({
  scan_id: z.string().min(1),
  image_reference: z.string().min(1),
  image_digest: z.string().min(1).optional().nullable(),
  started_at: z.string().min(1),
  completed_at: z.string().min(1).optional().nullable(),
  state: ImageScanStateSchema,
  scanner: z.string().min(1),
  error_message: z.string().optional().nullable(),
});

export type ImageScanRecord = z.infer<typeof ImageScanRecordSchema>;

export const ImageVulnerabilityInputSchema = z.object({
  id: z.string().min(1),
  scan_id: z.string().min(1),
  vulnerability_id: z.string().min(1),
  severity: z.string().min(1),
  package_name: z.string().optional().nullable(),
  installed_version: z.string().optional().nullable(),
  fixed_version: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  raw_metadata: z.string().optional().nullable(),
});

export type ImageVulnerabilityInput = z.infer<typeof ImageVulnerabilityInputSchema>;
