import { describe, it, expect } from 'vitest';
import {
  classifyRequestLimitRatio,
  formatRatioPercent,
  RESOURCE_RATIO_FAIL_BELOW,
  RESOURCE_RATIO_WARN_BELOW,
} from './resource-ratio-heuristics.js';

describe('classifyRequestLimitRatio', () => {
  it('returns ok when ratio is at or above warn threshold', () => {
    expect(classifyRequestLimitRatio(0.25, 1)).toBe('ok');
    expect(classifyRequestLimitRatio(RESOURCE_RATIO_WARN_BELOW, 1)).toBe('ok');
    expect(classifyRequestLimitRatio(0.5, 1)).toBe('ok');
  });

  it('returns warning when ratio is between fail and warn thresholds', () => {
    expect(classifyRequestLimitRatio(0.1, 1)).toBe('warning');
    expect(classifyRequestLimitRatio(RESOURCE_RATIO_FAIL_BELOW, 1)).toBe('warning');
  });

  it('returns fail when ratio is below fail threshold', () => {
    expect(classifyRequestLimitRatio(0.01, 1)).toBe('fail');
    expect(classifyRequestLimitRatio(0.04, 1)).toBe('fail');
  });

  it('returns fail when request exceeds limit', () => {
    expect(classifyRequestLimitRatio(2, 1)).toBe('fail');
  });

  it('returns ok when limit is not positive or values are non-finite', () => {
    expect(classifyRequestLimitRatio(1, 0)).toBe('ok');
    expect(classifyRequestLimitRatio(1, -1)).toBe('ok');
    expect(classifyRequestLimitRatio(Number.NaN, 1)).toBe('ok');
  });
});

describe('formatRatioPercent', () => {
  it('formats ratio as percentage', () => {
    expect(formatRatioPercent(0.25, 1)).toBe('25.0%');
    expect(formatRatioPercent(1, 4)).toBe('25.0%');
  });
});
