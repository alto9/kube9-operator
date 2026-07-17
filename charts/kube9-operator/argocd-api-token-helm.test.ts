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

describe('kube9-operator Helm chart argocd.api.token values', () => {
  it('default-off: no ARGOCD_API_TOKEN_FILE env or argocd-api-token mount', () => {
    const rendered = renderChart();
    if (!rendered) {
      return;
    }

    expect(rendered).not.toContain('name: ARGOCD_API_TOKEN_FILE');
    expect(rendered).not.toContain('name: argocd-api-token');
    expect(rendered).not.toContain('/var/run/secrets/kube9/argocd-api-token');
  });

  it('existingSecret: mounts Secret and sets ARGOCD_API_TOKEN_FILE', () => {
    const rendered = renderChart(
      '--set argocd.api.token.existingSecret=kube9-argocd-api-token --set argocd.api.token.existingSecretKey=token'
    );
    if (!rendered) {
      return;
    }

    expect(rendered).toContain('name: ARGOCD_API_TOKEN_FILE');
    expect(rendered).toContain('value: "/var/run/secrets/kube9/argocd-api-token"');
    expect(rendered).toContain('secretName: kube9-argocd-api-token');
    expect(rendered).toContain('mountPath: /var/run/secrets/kube9/argocd-api-token');
    expect(rendered).toContain('subPath: token');
  });
});
