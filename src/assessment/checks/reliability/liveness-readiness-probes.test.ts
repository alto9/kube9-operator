import { describe, it, expect, vi } from 'vitest';
import { livenessReadinessProbesCheck } from './liveness-readiness-probes.js';
import type { AssessmentRunContext } from '../../types.js';
import { Pillar, CheckStatus } from '../../types.js';

function createMockCtx(
  deployments: unknown[] = [],
  statefulSets: unknown[] = [],
  daemonSets: unknown[] = []
): AssessmentRunContext {
  return {
    kubernetes: {
      appsApi: {
        listDeploymentForAllNamespaces: vi
          .fn()
          .mockResolvedValue({ items: deployments }),
        listStatefulSetForAllNamespaces: vi
          .fn()
          .mockResolvedValue({ items: statefulSets }),
        listDaemonSetForAllNamespaces: vi
          .fn()
          .mockResolvedValue({ items: daemonSets }),
      },
    },
    config: {} as never,
    timeoutMs: 30000,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as never,
    runId: 'test-run',
    mode: 'full',
  } as unknown as AssessmentRunContext;
}

describe('livenessReadinessProbesCheck', () => {
  it('passes when Deployment has both liveness and readiness probes', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'app' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: {
                    httpGet: { path: '/healthz', port: 8080 },
                    initialDelaySeconds: 10,
                  },
                  readinessProbe: {
                    httpGet: { path: '/readyz', port: 8080 },
                    initialDelaySeconds: 5,
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.checkId).toBe('reliability.liveness-readiness-probes');
    expect(result.pillar).toBe(Pillar.Reliability);
    expect(result.status).toBe(CheckStatus.Passing);
    expect(result.message).toContain('valid liveness and readiness probes');
  });

  it('fails when Deployment missing liveness probe', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-liveness' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  readinessProbe: {
                    httpGet: { path: '/ready', port: 8080 },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('missing-liveness');
    expect(result.message).toContain('default/no-liveness');
    expect(result.remediation).toBeDefined();
  });

  it('fails when Deployment missing readiness probe', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-readiness' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: {
                    httpGet: { path: '/health', port: 8080 },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('missing-readiness');
  });

  it('fails when Deployment missing both probes', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'no-probes' },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'main' }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('both-missing');
  });

  it('fails when liveness and readiness are identical with zero initialDelaySeconds', async () => {
    const probe = {
      httpGet: { path: '/health', port: 8080 },
      initialDelaySeconds: 0,
      periodSeconds: 10,
    };
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'dangerous' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: probe,
                  readinessProbe: { ...probe },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('identical-dangerous');
    expect(result.message).toContain('premature restarts');
  });

  it('passes when identical probes have sufficient initialDelaySeconds', async () => {
    const probe = {
      httpGet: { path: '/health', port: 8080 },
      initialDelaySeconds: 15,
      periodSeconds: 10,
    };
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'ok-identical' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: probe,
                  readinessProbe: { ...probe },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('fails when httpGet probe missing path', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'bad-httpget' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: {
                    httpGet: { port: 8080 },
                    initialDelaySeconds: 5,
                  },
                  readinessProbe: {
                    httpGet: { path: '/ready', port: 8080 },
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('misconfigured');
    expect(result.message).toContain('httpGet missing path');
  });

  it('fails when tcpSocket probe missing port', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'bad-tcp' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: { tcpSocket: {} },
                  readinessProbe: { tcpSocket: { port: 8080 } },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('tcpSocket missing port');
  });

  it('fails when exec probe missing command', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'bad-exec' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: { exec: { command: ['echo', 'ok'] } },
                  readinessProbe: { exec: {} },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('exec missing command');
  });

  it('passes when tcpSocket probe is properly configured with different liveness/readiness', async () => {
    const deployments = [
      {
        metadata: { namespace: 'default', name: 'tcp-ok' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  livenessProbe: {
                    tcpSocket: { port: 8080 },
                    initialDelaySeconds: 15,
                    periodSeconds: 20,
                  },
                  readinessProbe: {
                    tcpSocket: { port: 8080 },
                    initialDelaySeconds: 5,
                    periodSeconds: 10,
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('skips workloads in kube-system', async () => {
    const deployments = [
      {
        metadata: { namespace: 'kube-system', name: 'coredns' },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'main' }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('skips workloads with probe-exempt label', async () => {
    const deployments = [
      {
        metadata: {
          namespace: 'default',
          name: 'exempt',
          labels: { 'kube9.io/probe-exempt': 'true' },
        },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'main' }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx(deployments);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('passes when no workloads exist', async () => {
    const ctx = createMockCtx();
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Passing);
  });

  it('validates StatefulSet and DaemonSet', async () => {
    const statefulSets = [
      {
        metadata: { namespace: 'default', name: 'db' },
        spec: {
          template: {
            spec: {
              containers: [{ name: 'main' }],
            },
          },
        },
      },
    ];
    const ctx = createMockCtx([], statefulSets, []);
    const result = await livenessReadinessProbesCheck.run(ctx);

    expect(result.status).toBe(CheckStatus.Failing);
    expect(result.message).toContain('default/db');
    expect(result.message).toContain('StatefulSet');
  });
});
