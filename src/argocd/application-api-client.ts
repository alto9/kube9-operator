/**
 * Argo CD REST: list Applications and extract sync/health fields (Argo CD v2 ApplicationList).
 */

import { z } from 'zod';
import type { ArgoCdApplicationStatusRecord } from './application-status-types.js';
import { jsonGet } from './api-http.js';

const applicationListItemSchema = z.object({
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
  status: z
    .object({
      sync: z
        .object({
          status: z.string().optional(),
          revision: z.string().optional(),
        })
        .optional(),
      health: z
        .object({
          status: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const applicationListSchema = z.object({
  items: z.array(applicationListItemSchema),
});

export class ArgoCdApplicationApiError extends Error {
  readonly code: 'HTTP_ERROR' | 'PARSE_ERROR';

  constructor(code: 'HTTP_ERROR' | 'PARSE_ERROR', message: string) {
    super(message);
    this.name = 'ArgoCdApplicationApiError';
    this.code = code;
  }
}

export function mapApplicationListToRecords(json: unknown): ArgoCdApplicationStatusRecord[] {
  const parsed = applicationListSchema.safeParse(json);
  if (!parsed.success) {
    throw new ArgoCdApplicationApiError('PARSE_ERROR', 'Unexpected Argo CD ApplicationList shape');
  }

  return parsed.data.items.map((item) => {
    const ns = item.metadata.namespace ?? 'default';
    const syncStatus = item.status?.sync?.status ?? null;
    const healthStatus = item.status?.health?.status ?? null;
    const revision = item.status?.sync?.revision ?? null;
    return {
      name: item.metadata.name,
      namespace: ns,
      syncStatus,
      healthStatus,
      revision,
    };
  });
}

/**
 * GET /api/v1/applications against the Argo CD API server.
 */
export async function fetchArgoCdApplications(params: {
  baseUrl: string;
  bearerToken: string;
  timeoutMs: number;
  tlsInsecure: boolean;
}): Promise<ArgoCdApplicationStatusRecord[]> {
  const base = params.baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/v1/applications`;
  const { status, json } = await jsonGet(url, {
    headers: {
      Authorization: `Bearer ${params.bearerToken}`,
      Accept: 'application/json',
    },
    timeoutMs: params.timeoutMs,
    tlsInsecure: params.tlsInsecure,
  });

  if (status < 200 || status >= 300) {
    throw new ArgoCdApplicationApiError(
      'HTTP_ERROR',
      `Argo CD applications list failed with HTTP ${status}`
    );
  }

  return mapApplicationListToRecords(json);
}
