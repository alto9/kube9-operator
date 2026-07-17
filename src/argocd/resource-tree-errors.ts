export type ResourceTreeErrorCode =
  | 'INVALID_ARGUMENT'
  | 'ARGOCD_NOT_DETECTED'
  | 'ARGOCD_TOKEN_MISSING'
  | 'ARGOCD_API_UNREACHABLE'
  | 'ARGOCD_AUTH_FAILED'
  | 'ARGOCD_RBAC_DENIED'
  | 'APPLICATION_NOT_FOUND'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export interface ResourceTreeErrorEnvelope {
  ok: false;
  code: ResourceTreeErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class ResourceTreeError extends Error {
  readonly code: ResourceTreeErrorCode;
  readonly exitCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ResourceTreeErrorCode,
    message: string,
    exitCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ResourceTreeError';
    this.code = code;
    this.exitCode = exitCode ?? exitCodeForResourceTreeError(code);
    this.details = details;
  }

  toEnvelope(): ResourceTreeErrorEnvelope {
    const envelope: ResourceTreeErrorEnvelope = {
      ok: false,
      code: this.code,
      message: this.message,
    };
    if (this.details && Object.keys(this.details).length > 0) {
      envelope.details = this.details;
    }
    return envelope;
  }
}

export function exitCodeForResourceTreeError(code: ResourceTreeErrorCode): number {
  switch (code) {
    case 'INVALID_ARGUMENT':
      return 2;
    case 'APPLICATION_NOT_FOUND':
      return 3;
    case 'ARGOCD_TOKEN_MISSING':
    case 'ARGOCD_AUTH_FAILED':
      return 4;
    case 'ARGOCD_RBAC_DENIED':
      return 5;
    case 'TIMEOUT':
      return 6;
    case 'ARGOCD_API_UNREACHABLE':
    case 'ARGOCD_NOT_DETECTED':
      return 7;
    case 'INTERNAL_ERROR':
    default:
      return 1;
  }
}

/** Cluster-wide probe failures demote global capability. Per-app CLI outcomes do not. */
export function isClusterWideResourceTreeFailure(code: ResourceTreeErrorCode): boolean {
  return (
    code === 'ARGOCD_TOKEN_MISSING' ||
    code === 'ARGOCD_API_UNREACHABLE' ||
    code === 'ARGOCD_AUTH_FAILED' ||
    code === 'ARGOCD_RBAC_DENIED' ||
    code === 'ARGOCD_NOT_DETECTED' ||
    code === 'INTERNAL_ERROR'
  );
}

export function mapHttpStatusToResourceTreeError(
  status: number,
  context: 'cli' | 'probe' = 'cli'
): ResourceTreeError {
  if (status === 401) {
    return new ResourceTreeError('ARGOCD_AUTH_FAILED', 'Argo CD API rejected the bearer token');
  }
  if (status === 403) {
    return new ResourceTreeError(
      'ARGOCD_RBAC_DENIED',
      context === 'probe'
        ? 'Argo CD API denied access during capability probe'
        : 'Argo CD API denied access to resource-tree'
    );
  }
  if (status === 404) {
    return new ResourceTreeError('APPLICATION_NOT_FOUND', 'Argo CD Application not found');
  }
  return new ResourceTreeError(
    'ARGOCD_API_UNREACHABLE',
    `Argo CD API request failed with HTTP ${status}`
  );
}

export function mapNetworkErrorToResourceTreeError(err: unknown): ResourceTreeError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('abort') ||
    err instanceof Error && err.name === 'AbortError'
  ) {
    return new ResourceTreeError('TIMEOUT', 'Argo CD API request timed out');
  }
  return new ResourceTreeError('ARGOCD_API_UNREACHABLE', `Cannot reach Argo CD API: ${message}`);
}

export function writeResourceTreeCliError(error: ResourceTreeError): never {
  console.error(JSON.stringify(error.toEnvelope()));
  process.exit(error.exitCode);
}
