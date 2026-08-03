import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const chartDir = path.join(process.cwd(), 'charts/kube9-operator');

function renderChart(extraArgs = ''): string | undefined {
  try {
    return execSync(
      `helm template kube9-operator ${chartDir} --namespace kube9-system ${extraArgs}`.trim(),
      { encoding: 'utf8', timeout: 15_000 }
    );
  } catch {
    return undefined;
  }
}

describe('kube9-operator Helm chart performance-metrics and security-posture wiring', () => {
  it('renders interval env vars on default install', () => {
    const rendered = renderChart();
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('name: PERFORMANCE_METRICS_INTERVAL_SECONDS');
    expect(rendered).toContain('value: "900"');
    expect(rendered).toContain('name: SECURITY_POSTURE_INTERVAL_SECONDS');
    expect(rendered).toContain('value: "86400"');
  });

  it('does not emit PROMETHEUS_BASE_URL when prometheus.baseUrl is empty', () => {
    const rendered = renderChart();
    if (!rendered) {
      return;
    }

    expect(rendered).not.toContain('name: PROMETHEUS_BASE_URL');
    expect(rendered).toContain('name: PROMETHEUS_TIMEOUT_MS');
    expect(rendered).toContain('name: PROMETHEUS_TLS_INSECURE');
  });

  it('emits Prometheus env when prometheus.baseUrl is set', () => {
    const rendered = renderChart(
      '--set prometheus.baseUrl=http://prometheus.monitoring.svc:9090'
    );
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('name: PROMETHEUS_BASE_URL');
    expect(rendered).toContain('value: "http://prometheus.monitoring.svc:9090"');
    expect(rendered).toContain('name: PROMETHEUS_TIMEOUT_MS');
    expect(rendered).toContain('value: "30000"');
    expect(rendered).toContain('name: PROMETHEUS_TLS_INSECURE');
    expect(rendered).toContain('value: "false"');
  });

  it('honors interval overrides via metrics.intervals values', () => {
    const rendered = renderChart(
      '--set metrics.intervals.performanceMetrics=600 --set metrics.intervals.securityPosture=7200'
    );
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('value: "600"');
    expect(rendered).toContain('value: "7200"');
  });

  it('documents dual-purpose NetworkPolicy ClusterRole grant', () => {
    const rendered = renderChart();
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('security-posture NetworkPolicy coverage');
    expect(rendered).toContain('apiGroups: ["networking.k8s.io"]');
    expect(rendered).toContain('resources: ["networkpolicies"]');
  });
});
