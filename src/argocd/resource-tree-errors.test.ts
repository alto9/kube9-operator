import { describe, expect, it } from 'vitest';
import {
  exitCodeForResourceTreeError,
  isClusterWideResourceTreeFailure,
  mapHttpStatusToResourceTreeError,
  ResourceTreeError,
} from './resource-tree-errors.js';

describe('resource-tree-errors', () => {
  it('maps exit codes per contract', () => {
    expect(exitCodeForResourceTreeError('INVALID_ARGUMENT')).toBe(2);
    expect(exitCodeForResourceTreeError('APPLICATION_NOT_FOUND')).toBe(3);
    expect(exitCodeForResourceTreeError('ARGOCD_TOKEN_MISSING')).toBe(4);
    expect(exitCodeForResourceTreeError('ARGOCD_AUTH_FAILED')).toBe(4);
    expect(exitCodeForResourceTreeError('ARGOCD_RBAC_DENIED')).toBe(5);
    expect(exitCodeForResourceTreeError('TIMEOUT')).toBe(6);
    expect(exitCodeForResourceTreeError('ARGOCD_NOT_DETECTED')).toBe(7);
    expect(exitCodeForResourceTreeError('ARGOCD_API_UNREACHABLE')).toBe(7);
    expect(exitCodeForResourceTreeError('INTERNAL_ERROR')).toBe(1);
  });

  it('maps HTTP statuses to resource-tree codes', () => {
    expect(mapHttpStatusToResourceTreeError(401).code).toBe('ARGOCD_AUTH_FAILED');
    expect(mapHttpStatusToResourceTreeError(403).code).toBe('ARGOCD_RBAC_DENIED');
    expect(mapHttpStatusToResourceTreeError(404).code).toBe('APPLICATION_NOT_FOUND');
    expect(mapHttpStatusToResourceTreeError(500).code).toBe('ARGOCD_API_UNREACHABLE');
  });

  it('serializes stderr envelope', () => {
    const err = new ResourceTreeError('ARGOCD_TOKEN_MISSING', 'token missing');
    expect(err.toEnvelope()).toEqual({
      ok: false,
      code: 'ARGOCD_TOKEN_MISSING',
      message: 'token missing',
    });
  });

  it('classifies cluster-wide vs per-app failures for demotion', () => {
    expect(isClusterWideResourceTreeFailure('ARGOCD_AUTH_FAILED')).toBe(true);
    expect(isClusterWideResourceTreeFailure('APPLICATION_NOT_FOUND')).toBe(false);
    expect(isClusterWideResourceTreeFailure('TIMEOUT')).toBe(false);
  });
});
