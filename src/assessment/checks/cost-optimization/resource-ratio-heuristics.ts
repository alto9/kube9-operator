/**
 * Heuristics for CPU/memory request-to-limit ratios (cost and rightsizing signals).
 *
 * Uses normalized numeric request and limit in the same unit (cores or bytes).
 * - request > limit: invalid sizing (fail).
 * - request/limit < 5%: extreme headroom vs guarantee (fail).
 * - request/limit < 20%: notable headroom (warning).
 */

/** Ratio of request to limit must be at least this to avoid a failing finding */
export const RESOURCE_RATIO_FAIL_BELOW = 0.05;

/** Ratio of request to limit must be at least this to avoid a warning */
export const RESOURCE_RATIO_WARN_BELOW = 0.2;

export type RequestLimitRatioClass = 'ok' | 'warning' | 'fail';

/**
 * Classify request/limit efficiency when both values are known and limit &gt; 0.
 * Returns 'ok' when the pair should not produce a finding (including unparseable edge cases).
 */
export function classifyRequestLimitRatio(request: number, limit: number): RequestLimitRatioClass {
  if (!Number.isFinite(request) || !Number.isFinite(limit) || limit <= 0) {
    return 'ok';
  }
  if (request > limit) {
    return 'fail';
  }
  const ratio = request / limit;
  if (ratio < RESOURCE_RATIO_FAIL_BELOW) {
    return 'fail';
  }
  if (ratio < RESOURCE_RATIO_WARN_BELOW) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Format ratio as a percentage string for messages (e.g. "4.0%").
 */
export function formatRatioPercent(request: number, limit: number): string {
  if (!Number.isFinite(request) || !Number.isFinite(limit) || limit <= 0) {
    return 'n/a';
  }
  return `${((100 * request) / limit).toFixed(1)}%`;
}
