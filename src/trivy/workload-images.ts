/**
 * Container image references from workload API objects (Pods, Deployments, StatefulSets).
 *
 * Normalization for Trivy scanner input:
 * - Leading and trailing whitespace is stripped; empty values are ignored.
 * - References are passed through as Kubernetes reports them (tag and/or digest).
 * - When a digest is present (`repo@sha256:...` or `:tag@sha256:...`), that immutable
 *   form is preferred for scanning; tag-only refs are unchanged.
 *
 * This module does not call Trivy or any scanner; it only shapes strings from the API.
 */

import type * as k8s from '@kubernetes/client-node';

/** Default cap on distinct normalized references collected per pass (deterministic truncation). */
export const DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES = 10_000;

/**
 * Normalize a raw container image field from the API for deduplication and scanner input.
 */
export function normalizeContainerImageRef(raw: string): string | null {
  const s = raw.trim();
  if (!s.length) {
    return null;
  }
  return s;
}

function addImagesFromContainers(
  containers: k8s.V1Container[] | undefined,
  into: Set<string>,
  maxUnique: number,
  onTruncated: () => void
): void {
  if (!containers?.length) {
    return;
  }
  for (const c of containers) {
    tryAddNormalized(into, c.image, maxUnique, onTruncated);
  }
}

function tryAddNormalized(
  into: Set<string>,
  raw: string | undefined,
  maxUnique: number,
  onTruncated: () => void
): void {
  const n = normalizeContainerImageRef(raw ?? '');
  if (!n) {
    return;
  }
  if (into.has(n)) {
    return;
  }
  if (into.size >= maxUnique) {
    onTruncated();
    return;
  }
  into.add(n);
}

/**
 * Add all image references from a Pod spec into a shared set (for cross-resource collection with one cap).
 */
export function addPodSpecImagesInto(
  into: Set<string>,
  spec: k8s.V1PodSpec | undefined,
  maxUnique: number,
  onTruncated: () => void
): void {
  addImagesFromContainers(spec?.containers, into, maxUnique, onTruncated);
  addImagesFromContainers(spec?.initContainers, into, maxUnique, onTruncated);
  if (spec?.ephemeralContainers?.length) {
    for (const ec of spec.ephemeralContainers) {
      tryAddNormalized(into, ec.image, maxUnique, onTruncated);
    }
  }
}

/**
 * Extract normalized image references from a Pod spec (containers, init, ephemeral).
 */
export function extractImagesFromPodSpec(
  spec: k8s.V1PodSpec | undefined,
  options?: { maxUnique?: number }
): { images: string[]; truncated: boolean } {
  const maxUnique = options?.maxUnique ?? DEFAULT_MAX_UNIQUE_WORKLOAD_IMAGES;
  const into = new Set<string>();
  let truncated = false;
  const onTruncated = (): void => {
    truncated = true;
  };

  addPodSpecImagesInto(into, spec, maxUnique, onTruncated);

  const images = Array.from(into).sort((a, b) => a.localeCompare(b));
  return { images, truncated };
}
