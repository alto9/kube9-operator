import { describe, it, expect } from 'vitest';
import { collectImagesFromListResponses } from './collect-workload-images.js';
import type * as k8s from '@kubernetes/client-node';

describe('collectImagesFromListResponses', () => {
  it('dedupes across pods, deployments, and statefulsets', () => {
    const pods: k8s.V1PodList = {
      apiVersion: 'v1',
      kind: 'PodList',
      items: [
        {
          metadata: { name: 'p', namespace: 'ns' },
          spec: {
            containers: [{ name: 'c', image: 'shared:1' }],
            initContainers: [{ name: 'i', image: 'init:1' }],
          },
        },
      ],
    };
    const deployments: k8s.V1DeploymentList = {
      apiVersion: 'apps/v1',
      kind: 'DeploymentList',
      items: [
        {
          metadata: { name: 'd', namespace: 'ns' },
          spec: {
            selector: { matchLabels: { app: 'd' } },
            template: {
              metadata: { labels: { app: 'd' } },
              spec: {
                containers: [{ name: 'c', image: 'shared:1' }],
                initContainers: [{ name: 'i', image: 'init:1' }],
              },
            },
          },
        },
      ],
    };
    const statefulSets: k8s.V1StatefulSetList = {
      apiVersion: 'apps/v1',
      kind: 'StatefulSetList',
      items: [
        {
          metadata: { name: 's', namespace: 'ns' },
          spec: {
            selector: { matchLabels: { app: 's' } },
            template: {
              metadata: { labels: { app: 's' } },
              spec: {
                containers: [{ name: 'c', image: 'sts:1' }],
              },
            },
          },
        },
      ],
    };

    const { images, truncated } = collectImagesFromListResponses({
      pods,
      deployments,
      statefulSets,
    });
    expect(truncated).toBe(false);
    expect(images).toEqual(['init:1', 'shared:1', 'sts:1']);
  });
});
