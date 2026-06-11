import { describe, it, expect, vi } from 'vitest';
import type { AiConformanceChecklistRequirement } from './checklist/contracts.js';
import {
  evaluateRequirement,
  evaluateChecklistRequirements,
} from './evaluator.js';
import type { KubernetesClient } from '../kubernetes/client.js';

function requirement(
  id: string,
  overrides: Partial<AiConformanceChecklistRequirement> = {}
): AiConformanceChecklistRequirement {
  return {
    id,
    category: overrides.category ?? 'security',
    level: overrides.level ?? 'MUST',
    title: overrides.title ?? 'Test requirement',
    description: overrides.description ?? 'Test description',
  };
}

function mockKubernetes(overrides: Partial<KubernetesClient> = {}): KubernetesClient {
  return {
    rbacApi: {
      listClusterRole: vi.fn().mockResolvedValue({ items: [] }),
      listRoleForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      listClusterRoleBinding: vi.fn().mockResolvedValue({ items: [] }),
      listRoleBindingForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    appsApi: {
      listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    policyApi: {
      listPodDisruptionBudgetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    networkingApi: {
      listNetworkPolicyForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
    },
    ...overrides,
  } as unknown as KubernetesClient;
}

describe('AiConformance evaluator', () => {
  it('maps RBAC least-privilege to passed when no violations', async () => {
    const result = await evaluateRequirement(
      requirement('security.rbac-least-privilege'),
      { kubernetes: mockKubernetes() }
    );
    expect(result.status).toBe('passed');
  });

  it('maps RBAC wildcard rules to failed', async () => {
    const k8s = mockKubernetes({
      rbacApi: {
        listClusterRole: vi.fn().mockResolvedValue({
          items: [
            {
              metadata: { name: 'wildcard-role' },
              rules: [{ resources: ['*'], verbs: ['get'], apiGroups: [''] }],
            },
          ],
        }),
        listRoleForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listClusterRoleBinding: vi.fn().mockResolvedValue({ items: [] }),
        listRoleBindingForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
    } as unknown as Partial<KubernetesClient>);

    const result = await evaluateRequirement(
      requirement('security.rbac-least-privilege'),
      { kubernetes: k8s }
    );
    expect(result.status).toBe('failed');
  });

  it('maps secrets encryption to needs-evidence', async () => {
    const result = await evaluateRequirement(
      requirement('security.secrets-encryption-at-rest'),
      { kubernetes: mockKubernetes() }
    );
    expect(result.status).toBe('needs-evidence');
  });

  it('maps audit logging to needs-evidence', async () => {
    const result = await evaluateRequirement(
      requirement('observability.audit-logging', {
        category: 'operational-excellence',
        level: 'SHOULD',
      }),
      { kubernetes: mockKubernetes() }
    );
    expect(result.status).toBe('needs-evidence');
  });

  it('maps network policy gaps to failed', async () => {
    const k8s = mockKubernetes({
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({
          items: [{ metadata: { namespace: 'app', name: 'api' }, spec: { replicas: 1 } }],
        }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
      networkingApi: {
        listNetworkPolicyForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
    } as unknown as Partial<KubernetesClient>);

    const result = await evaluateRequirement(
      requirement('security.network-policy-default-deny'),
      { kubernetes: k8s }
    );
    expect(result.status).toBe('failed');
  });

  it('maps PDB gaps to warning for HA workloads', async () => {
    const k8s = mockKubernetes({
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn().mockResolvedValue({
          items: [
            {
              metadata: { namespace: 'app', name: 'api', labels: { app: 'api' } },
              spec: {
                replicas: 3,
                template: { metadata: { labels: { app: 'api' } } },
              },
            },
          ],
        }),
        listStatefulSetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
      policyApi: {
        listPodDisruptionBudgetForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
    } as unknown as Partial<KubernetesClient>);

    const result = await evaluateRequirement(
      requirement('reliability.pod-disruption-budgets', {
        category: 'reliability',
        level: 'SHOULD',
      }),
      { kubernetes: k8s }
    );
    expect(result.status).toBe('warning');
  });

  it('maps unregistered requirements to not-evaluated', async () => {
    const result = await evaluateRequirement(
      requirement('custom.unknown-requirement'),
      { kubernetes: mockKubernetes() }
    );
    expect(result.status).toBe('not-evaluated');
  });

  it('maps API failures to not-evaluated without throwing', async () => {
    const k8s = mockKubernetes({
      rbacApi: {
        listClusterRole: vi.fn().mockRejectedValue(new Error('API unavailable')),
        listRoleForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listClusterRoleBinding: vi.fn().mockResolvedValue({ items: [] }),
        listRoleBindingForAllNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      },
    } as unknown as Partial<KubernetesClient>);

    const result = await evaluateRequirement(
      requirement('security.rbac-least-privilege'),
      { kubernetes: k8s }
    );
    expect(result.status).toBe('not-evaluated');
    expect(result.rationale).toContain('Could not list RBAC resources');
  });

  it('evaluates all checklist requirements in order', async () => {
    const requirements = [
      requirement('security.rbac-least-privilege'),
      requirement('security.secrets-encryption-at-rest'),
    ];
    const results = await evaluateChecklistRequirements(requirements, {
      kubernetes: mockKubernetes(),
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.status)).toEqual(['passed', 'needs-evidence']);
  });
});
