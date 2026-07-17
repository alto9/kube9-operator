/**
 * Argo CD REST: GET /api/v1/applications/{name}/resource-tree (raw JSON passthrough).
 */

import { textGet } from './api-http.js';
import {
  mapHttpStatusToResourceTreeError,
  mapNetworkErrorToResourceTreeError,
  ResourceTreeError,
} from './resource-tree-errors.js';

export interface FetchArgoCdResourceTreeParams {
  baseUrl: string;
  appName: string;
  appNamespace: string;
  bearerToken: string;
  timeoutMs: number;
  tlsInsecure: boolean;
}

/**
 * Fetch resource-tree JSON body without parsing or reshaping.
 */
export async function fetchArgoCdResourceTree(
  params: FetchArgoCdResourceTreeParams
): Promise<string> {
  const base = params.baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/v1/applications/${encodeURIComponent(params.appName)}/resource-tree?appNamespace=${encodeURIComponent(params.appNamespace)}`;

  try {
    const { status, body } = await textGet(url, {
      headers: {
        Authorization: `Bearer ${params.bearerToken}`,
        Accept: 'application/json',
      },
      timeoutMs: params.timeoutMs,
      tlsInsecure: params.tlsInsecure,
    });

    if (status >= 200 && status < 300) {
      return body;
    }

    throw mapHttpStatusToResourceTreeError(status, 'cli');
  } catch (err) {
    if (err instanceof ResourceTreeError) {
      throw err;
    }
    throw mapNetworkErrorToResourceTreeError(err);
  }
}

/**
 * Lightweight probe: list Applications to verify dedicated token and connectivity.
 */
export async function probeArgoCdResourceTreeCapability(params: {
  baseUrl: string;
  bearerToken: string;
  timeoutMs: number;
  tlsInsecure: boolean;
}): Promise<void> {
  const base = params.baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/v1/applications`;

  try {
    const { status } = await textGet(url, {
      headers: {
        Authorization: `Bearer ${params.bearerToken}`,
        Accept: 'application/json',
      },
      timeoutMs: params.timeoutMs,
      tlsInsecure: params.tlsInsecure,
    });

    if (status >= 200 && status < 300) {
      return;
    }

    throw mapHttpStatusToResourceTreeError(status, 'probe');
  } catch (err) {
    if (err instanceof ResourceTreeError) {
      throw err;
    }
    throw mapNetworkErrorToResourceTreeError(err);
  }
}
