import { describe, it, expect } from 'vitest';
import {
  recordRunState,
  recordCheckResult,
  recordRunComplete,
} from './metrics.js';
import { Pillar, CheckStatus } from './types.js';
import { register } from '../collection/metrics.js';

function parseCounterFromMetrics(
  metrics: string,
  name: string,
  labels: Record<string, string>
): number {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  const regex = new RegExp(`${name}\\{${labelStr.replace(/"/g, '\\"')}\\} (\\d+)`);
  const match = metrics.match(regex);
  return match ? parseInt(match[1], 10) : 0;
}

function parseGaugeFromMetrics(metrics: string, name: string): number {
  const regex = new RegExp(`${name} (\\d+(?:\\.\\d+)?)`);
  const match = metrics.match(regex);
  return match ? parseFloat(match[1]) : 0;
}

describe('assessment metrics', () => {
  describe('metric registration', () => {
    it('registers assessment metric families in the shared registry', async () => {
      const metrics = await register.metrics();
      const names = [
        'kube9_operator_assessment_runs_total',
        'kube9_operator_assessment_checks_total',
        'kube9_operator_assessment_run_duration_seconds',
        'kube9_operator_assessment_check_duration_seconds',
        'kube9_operator_assessment_last_run_timestamp',
        'kube9_operator_assessment_last_score',
      ];
      for (const name of names) {
        expect(metrics).toContain(`# HELP ${name}`);
        expect(metrics).toContain(`# TYPE ${name}`);
      }
    });
  });

  describe('recordRunState', () => {
    it('increments assessment_runs_total for the given state', async () => {
      recordRunState('completed');
      const metrics = await register.metrics();
      const value = parseCounterFromMetrics(metrics, 'kube9_operator_assessment_runs_total', {
        state: 'completed',
      });
      expect(value).toBeGreaterThanOrEqual(1);
    });

    it('maps unknown state to "unknown" label', async () => {
      recordRunState('invalid-state' as 'completed');
      const metrics = await register.metrics();
      const value = parseCounterFromMetrics(metrics, 'kube9_operator_assessment_runs_total', {
        state: 'unknown',
      });
      expect(value).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recordCheckResult', () => {
    it('increments assessment_checks_total and observes check duration', async () => {
      recordCheckResult(Pillar.Security, CheckStatus.Passing, 0.5);
      const metrics = await register.metrics();
      const value = parseCounterFromMetrics(metrics, 'kube9_operator_assessment_checks_total', {
        pillar: 'security',
        status: 'passing',
      });
      expect(value).toBeGreaterThanOrEqual(1);
      expect(metrics).toContain('kube9_operator_assessment_check_duration_seconds');
    });
  });

  describe('recordRunComplete', () => {
    it('observes run duration and updates last timestamp and score', async () => {
      recordRunComplete(10.5, 20, 16);
      const metrics = await register.metrics();
      expect(metrics).toContain('kube9_operator_assessment_run_duration_seconds');
      expect(metrics).toContain('kube9_operator_assessment_last_run_timestamp');
      const score = parseGaugeFromMetrics(metrics, 'kube9_operator_assessment_last_score');
      expect(score).toBe(80); // 16/20 * 100
    });

    it('sets score to 0 when totalChecks is 0', async () => {
      recordRunComplete(1, 0, 0);
      const metrics = await register.metrics();
      const score = parseGaugeFromMetrics(metrics, 'kube9_operator_assessment_last_score');
      expect(score).toBe(0);
    });
  });
});
