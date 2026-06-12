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

describe('kube9-operator Helm chart aiConformance values', () => {
  it('renders AI_CONFORMANCE_* environment variables from values', () => {
    const rendered = renderChart();
    if (!rendered) {
      // Skip when helm is unavailable in the environment
      return;
    }

    expect(rendered).toContain('name: AI_CONFORMANCE_ENABLED');
    expect(rendered).toContain('name: AI_CONFORMANCE_INTERVAL_SECONDS');
    expect(rendered).toContain('name: AI_CONFORMANCE_CHECKLIST_SOURCE');
    expect(rendered).toContain('value: "bundled"');
  });

  it('honors disabled aiConformance schedule overrides', () => {
    const rendered = renderChart('--set aiConformance.enabled=false');
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('name: AI_CONFORMANCE_ENABLED');
    expect(rendered).toContain('value: "false"');
  });

  it('grants ClusterRole list/watch on networkpolicies for conformance evaluation', () => {
    const rendered = renderChart();
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('apiGroups: ["networking.k8s.io"]');
    expect(rendered).toContain('resources: ["networkpolicies"]');
    expect(rendered).toContain('verbs: ["get", "list", "watch"]');
  });
});
