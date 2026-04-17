import { describe, it, expect } from 'vitest';
import { containerDeclaresProbePort } from './kube9-operator-shared.js';
import type * as k8s from '@kubernetes/client-node';

describe('containerDeclaresProbePort', () => {
  it('returns true when numeric port matches containerPort', () => {
    const container: k8s.V1Container = {
      name: 'operator',
      ports: [{ name: 'http', containerPort: 8080 }],
    };
    expect(
      containerDeclaresProbePort({ path: '/x', port: 8080 } as k8s.V1HTTPGetAction, container)
    ).toBe(true);
  });

  it('returns true when named port matches container port name', () => {
    const container: k8s.V1Container = {
      name: 'operator',
      ports: [{ name: 'http', containerPort: 8080 }],
    };
    expect(
      containerDeclaresProbePort({ path: '/x', port: 'http' } as k8s.V1HTTPGetAction, container)
    ).toBe(true);
  });

  it('returns false when port not declared', () => {
    const container: k8s.V1Container = {
      name: 'operator',
      ports: [{ name: 'http', containerPort: 8080 }],
    };
    expect(
      containerDeclaresProbePort({ path: '/x', port: 9090 } as k8s.V1HTTPGetAction, container)
    ).toBe(false);
  });
});
