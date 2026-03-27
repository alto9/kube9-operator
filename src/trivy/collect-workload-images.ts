/**
 * Lists Pods, Deployments, and StatefulSets and collects distinct normalized container image references.
 * Uses existing read-only workload RBAC; does not invoke Trivy.
 */

import type * as k8s from '@kubernetes/client-node';
import type { KubernetesClient } from '../kubernetes/client.js';
import {
  DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES,
  addPodSpecImagesInto,
} from './workload-images.js';

export interface CollectWorkloadImagesResult {
  /** Sorted unique normalized image references */
  images: string[];
  /** True if the unique cap was reached while still finding new references */
  truncated: boolean;
}

/**
 * Collect distinct container image references from all Pods, Deployments, and StatefulSets cluster-wide.
 * ReplicaSets are not listed separately; their images are covered by Pods and Deployment templates.
 */
export async function collectWorkloadImageReferences(
  client: KubernetesClient,
  options?: { maxUniqueImages?: number }
): Promise<CollectWorkloadImagesResult> {
  const maxUnique = options?.maxUniqueImages ?? DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES;
  const unique = new Set<string>();
  let truncated = false;
  const onTruncated = (): void => {
    truncated = true;
  };

  const [podsRes, deploymentsRes, statefulSetsRes] = await Promise.all([
    client.coreApi.listPodForAllNamespaces(),
    client.appsApi.listDeploymentForAllNamespaces(),
    client.appsApi.listStatefulSetForAllNamespaces(),
  ]);

  for (const pod of podsRes.items ?? []) {
    addPodSpecImagesInto(unique, pod.spec, maxUnique, onTruncated);
  }

  for (const d of deploymentsRes.items ?? []) {
    addPodSpecImagesInto(unique, d.spec?.template?.spec, maxUnique, onTruncated);
  }

  for (const s of statefulSetsRes.items ?? []) {
    addPodSpecImagesInto(unique, s.spec?.template?.spec, maxUnique, onTruncated);
  }

  const images = Array.from(unique).sort((a, b) => a.localeCompare(b));
  return { images, truncated };
}

/** @internal Exported for tests that build mock list responses */
export function collectImagesFromListResponses(responses: {
  pods: k8s.V1PodList;
  deployments: k8s.V1DeploymentList;
  statefulSets: k8s.V1StatefulSetList;
}): CollectWorkloadImagesResult {
  const maxUnique = DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES;
  const unique = new Set<string>();
  let truncated = false;
  const onTruncated = (): void => {
    truncated = true;
  };

  for (const pod of responses.pods.items ?? []) {
    addPodSpecImagesInto(unique, pod.spec, maxUnique, onTruncated);
  }
  for (const d of responses.deployments.items ?? []) {
    addPodSpecImagesInto(unique, d.spec?.template?.spec, maxUnique, onTruncated);
  }
  for (const s of responses.statefulSets.items ?? []) {
    addPodSpecImagesInto(unique, s.spec?.template?.spec, maxUnique, onTruncated);
  }

  const images = Array.from(unique).sort((a, b) => a.localeCompare(b));
  return { images, truncated };
}
