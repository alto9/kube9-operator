import { describe, it, expect } from 'vitest';
import {
  Pillar,
  isPillar,
  CheckStatus,
  isCheckStatus,
  Severity,
  isSeverity,
  AssessmentRunMode,
  AssessmentRunState,
  isAssessmentRunMode,
  isAssessmentRunState,
} from './types.js';

describe('assessment types', () => {
  describe('isPillar', () => {
    it('returns true for valid pillar enum values', () => {
      expect(isPillar(Pillar.Security)).toBe(true);
      expect(isPillar(Pillar.Reliability)).toBe(true);
      expect(isPillar(Pillar.PerformanceEfficiency)).toBe(true);
      expect(isPillar(Pillar.CostOptimization)).toBe(true);
      expect(isPillar(Pillar.OperationalExcellence)).toBe(true);
      expect(isPillar(Pillar.Sustainability)).toBe(true);
    });

    it('returns true for valid pillar string values', () => {
      expect(isPillar('security')).toBe(true);
      expect(isPillar('reliability')).toBe(true);
      expect(isPillar('performance-efficiency')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isPillar('invalid')).toBe(false);
      expect(isPillar('Security')).toBe(false); // case-sensitive
      expect(isPillar('')).toBe(false);
      expect(isPillar(null)).toBe(false);
      expect(isPillar(undefined)).toBe(false);
      expect(isPillar(123)).toBe(false);
    });
  });

  describe('isCheckStatus', () => {
    it('returns true for valid check status enum values', () => {
      expect(isCheckStatus(CheckStatus.Passing)).toBe(true);
      expect(isCheckStatus(CheckStatus.Failing)).toBe(true);
      expect(isCheckStatus(CheckStatus.Warning)).toBe(true);
      expect(isCheckStatus(CheckStatus.Skipped)).toBe(true);
      expect(isCheckStatus(CheckStatus.Error)).toBe(true);
      expect(isCheckStatus(CheckStatus.Timeout)).toBe(true);
    });

    it('returns true for valid status string values', () => {
      expect(isCheckStatus('passing')).toBe(true);
      expect(isCheckStatus('failing')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isCheckStatus('invalid')).toBe(false);
      expect(isCheckStatus('Passing')).toBe(false);
      expect(isCheckStatus(null)).toBe(false);
      expect(isCheckStatus(undefined)).toBe(false);
    });
  });

  describe('isSeverity', () => {
    it('returns true for valid severity enum values', () => {
      expect(isSeverity(Severity.Critical)).toBe(true);
      expect(isSeverity(Severity.High)).toBe(true);
      expect(isSeverity(Severity.Medium)).toBe(true);
      expect(isSeverity(Severity.Low)).toBe(true);
      expect(isSeverity(Severity.Info)).toBe(true);
    });

    it('returns true for valid severity string values', () => {
      expect(isSeverity('critical')).toBe(true);
      expect(isSeverity('high')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isSeverity('invalid')).toBe(false);
      expect(isSeverity(null)).toBe(false);
      expect(isSeverity(undefined)).toBe(false);
    });
  });

  describe('isAssessmentRunMode', () => {
    it('returns true for valid run mode values', () => {
      expect(isAssessmentRunMode(AssessmentRunMode.Full)).toBe(true);
      expect(isAssessmentRunMode(AssessmentRunMode.Pillar)).toBe(true);
      expect(isAssessmentRunMode(AssessmentRunMode.SingleCheck)).toBe(true);
      expect(isAssessmentRunMode('full')).toBe(true);
      expect(isAssessmentRunMode('pillar')).toBe(true);
      expect(isAssessmentRunMode('single-check')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isAssessmentRunMode('invalid')).toBe(false);
      expect(isAssessmentRunMode(null)).toBe(false);
    });
  });

  describe('isAssessmentRunState', () => {
    it('returns true for valid run state values', () => {
      expect(isAssessmentRunState(AssessmentRunState.Queued)).toBe(true);
      expect(isAssessmentRunState(AssessmentRunState.Running)).toBe(true);
      expect(isAssessmentRunState(AssessmentRunState.Completed)).toBe(true);
      expect(isAssessmentRunState(AssessmentRunState.Failed)).toBe(true);
      expect(isAssessmentRunState(AssessmentRunState.Partial)).toBe(true);
      expect(isAssessmentRunState('queued')).toBe(true);
      expect(isAssessmentRunState('completed')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isAssessmentRunState('invalid')).toBe(false);
      expect(isAssessmentRunState(null)).toBe(false);
    });
  });
});
