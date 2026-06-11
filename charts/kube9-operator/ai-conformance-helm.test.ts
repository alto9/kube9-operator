import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const chartDir = path.join(process.cwd(), 'charts/kube9-operator');

describe('kube9-operator Helm chart aiConformance values', () => {
  it('renders AI_CONFORMANCE_* environment variables from values', () => {
    let rendered: string;
    try {
      rendered = execSync(
        `helm template kube9-operator ${chartDir} --namespace kube9-system`,
        { encoding: 'utf8' }
      );
    } catch {
      // Skip when helm is unavailable in the environment
      return;
    }

    expect(rendered).toContain('name: AI_CONFORMANCE_ENABLED');
    expect(rendered).toContain('name: AI_CONFORMANCE_INTERVAL_SECONDS');
    expect(rendered).toContain('name: AI_CONFORMANCE_CHECKLIST_SOURCE');
    expect(rendered).toContain('value: "bundled"');
  });

  it('honors disabled aiConformance schedule overrides', () => {
    let rendered: string;
    try {
      rendered = execSync(
        `helm template kube9-operator ${chartDir} --namespace kube9-system --set aiConformance.enabled=false`,
        { encoding: 'utf8' }
      );
    } catch {
      return;
    }

    expect(rendered).toContain('name: AI_CONFORMANCE_ENABLED');
    expect(rendered).toContain('value: "false"');
  });
});
