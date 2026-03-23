import { describe, it, expect } from 'vitest';
import {
  isHaExempt,
  isNamespaceExcluded,
  isHaRelevant,
  isProbeExempt,
  isProbeCheckRelevant,
  HA_EXEMPT_LABEL,
  HA_REQUIRED_LABEL,
  PROBE_EXEMPT_LABEL,
} from './heuristics.js';

describe('reliability heuristics', () => {
  describe('isHaExempt', () => {
    it('returns true when kube9.io/ha-exempt is true', () => {
      expect(isHaExempt({
        namespace: 'default', name: 'x', kind: 'Deployment',
        labels: { [HA_EXEMPT_LABEL]: 'true' },
      })).toBe(true);
    });

    it('returns true when kube9.io/ha-exempt is 1', () => {
      expect(isHaExempt({
        namespace: 'default', name: 'x', kind: 'Deployment',
        labels: { [HA_EXEMPT_LABEL]: '1' },
      })).toBe(true);
    });

    it('returns false when label is absent', () => {
      expect(isHaExempt({
        namespace: 'default', name: 'x', kind: 'Deployment',
      })).toBe(false);
    });
  });

  describe('isNamespaceExcluded', () => {
    it('excludes kube-system', () => {
      expect(isNamespaceExcluded('kube-system')).toBe(true);
    });

    it('excludes kube-public and kube-node-lease', () => {
      expect(isNamespaceExcluded('kube-public')).toBe(true);
      expect(isNamespaceExcluded('kube-node-lease')).toBe(true);
    });

    it('does not exclude default', () => {
      expect(isNamespaceExcluded('default')).toBe(false);
    });
  });

  describe('isHaRelevant', () => {
    it('returns false when ha-exempt', () => {
      expect(isHaRelevant({
        namespace: 'default', name: 'x', kind: 'Deployment',
        labels: { [HA_EXEMPT_LABEL]: 'true' },
      })).toBe(false);
    });

    it('returns false when namespace is excluded', () => {
      expect(isHaRelevant({
        namespace: 'kube-system', name: 'x', kind: 'Deployment',
      })).toBe(false);
    });

    it('returns true when ha-required label is set', () => {
      expect(isHaRelevant({
        namespace: 'default', name: 'x', kind: 'CronJob',
        labels: { [HA_REQUIRED_LABEL]: 'true' },
      })).toBe(true);
    });

    it('returns true for Deployment in non-excluded namespace', () => {
      expect(isHaRelevant({
        namespace: 'default', name: 'app', kind: 'Deployment',
      })).toBe(true);
    });

    it('returns true for StatefulSet in non-excluded namespace', () => {
      expect(isHaRelevant({
        namespace: 'default', name: 'db', kind: 'StatefulSet',
      })).toBe(true);
    });

    it('returns false for unknown kind without ha-required', () => {
      expect(isHaRelevant({
        namespace: 'default', name: 'x', kind: 'CronJob',
      })).toBe(false);
    });
  });

  describe('isProbeExempt', () => {
    it('returns true when kube9.io/probe-exempt is true', () => {
      expect(isProbeExempt({
        namespace: 'default', name: 'x', kind: 'Deployment',
        labels: { [PROBE_EXEMPT_LABEL]: 'true' },
      })).toBe(true);
    });

    it('returns false when label is absent', () => {
      expect(isProbeExempt({
        namespace: 'default', name: 'x', kind: 'Deployment',
      })).toBe(false);
    });
  });

  describe('isProbeCheckRelevant', () => {
    it('returns false when probe-exempt', () => {
      expect(isProbeCheckRelevant({
        namespace: 'default', name: 'x', kind: 'Deployment',
        labels: { [PROBE_EXEMPT_LABEL]: 'true' },
      })).toBe(false);
    });

    it('returns false when namespace is excluded', () => {
      expect(isProbeCheckRelevant({
        namespace: 'kube-system', name: 'x', kind: 'Deployment',
      })).toBe(false);
    });

    it('returns true for Deployment in non-excluded namespace', () => {
      expect(isProbeCheckRelevant({
        namespace: 'default', name: 'app', kind: 'Deployment',
      })).toBe(true);
    });
  });
});
