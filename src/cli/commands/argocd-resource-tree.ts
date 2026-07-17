/**
 * CLI: on-demand Argo CD resource-tree query (M17).
 */

import { z } from 'zod';
import { detectArgoCDWithTimeout, parseArgoCDConfigFromEnv } from '../../argocd/detection.js';
import { fetchArgoCdResourceTree } from '../../argocd/resource-tree-api-client.js';
import { resolveResourceTreeRequestContext } from '../../argocd/resource-tree-context.js';
import {
  ResourceTreeError,
  writeResourceTreeCliError,
} from '../../argocd/resource-tree-errors.js';
import { kubernetesClient } from '../../kubernetes/client.js';
import type { ArgoCDStatus } from '../../status/types.js';

const GetOptionsSchema = z.object({
  namespace: z.string().min(1, 'Application namespace is required'),
  format: z.enum(['json']).optional().default('json'),
});

export async function getArgoCDResourceTree(
  appName: string | undefined,
  options: Record<string, unknown>
) {
  try {
    const parsed = GetOptionsSchema.safeParse(options);
    if (!parsed.success || !appName || appName.trim() === '') {
      throw new ResourceTreeError(
        'INVALID_ARGUMENT',
        'Usage: query argocd resource-tree get <appName> --namespace=<appNamespace> [--format=json]'
      );
    }

    if (parsed.data.format !== 'json') {
      throw new ResourceTreeError(
        'INVALID_ARGUMENT',
        'Only --format=json is supported for resource-tree get'
      );
    }

    let argocdStatus: ArgoCDStatus;
    try {
      argocdStatus = await detectArgoCDWithTimeout(
        kubernetesClient,
        parseArgoCDConfigFromEnv(),
        10000
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ResourceTreeError('INTERNAL_ERROR', `Argo CD detection failed: ${message}`);
    }

    const ctx = resolveResourceTreeRequestContext(argocdStatus);
    const body = await fetchArgoCdResourceTree({
      baseUrl: ctx.baseUrl,
      appName: appName.trim(),
      appNamespace: parsed.data.namespace.trim(),
      bearerToken: ctx.bearerToken,
      timeoutMs: ctx.env.timeoutMs,
      tlsInsecure: ctx.env.tlsInsecure,
    });

    process.stdout.write(body.endsWith('\n') ? body : `${body}\n`);
  } catch (err) {
    if (err instanceof ResourceTreeError) {
      writeResourceTreeCliError(err);
    }
    const message = err instanceof Error ? err.message : String(err);
    writeResourceTreeCliError(new ResourceTreeError('INTERNAL_ERROR', message));
  }
}
