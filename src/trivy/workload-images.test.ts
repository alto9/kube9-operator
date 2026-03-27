import { describe, it, expect } from 'vitest';
import {
  normalizeContainerImageRef,
  extractImagesFromPodSpec,
} from './workload-images.js';
import type * as k8s from '@kubernetes/client-node';

describe('normalizeContainerImageRef', () => {
  it('trims whitespace and rejects empty', () => {
    expect(normalizeContainerImageRef('  alpine:3.20  ')).toBe('alpine:3.20');
    expect(normalizeContainerImageRef('')).toBeNull();
    expect(normalizeContainerImageRef('   ')).toBeNull();
  });

  it('preserves digest and tag forms as reported by Kubernetes', () => {
    expect(normalizeContainerImageRef('repo.io/ns/app:v1@sha256:abc')).toBe(
      'repo.io/ns/app:v1@sha256:abc'
    );
    expect(normalizeContainerImageRef('busybox:latest')).toBe('busybox:latest');
  });
});

describe('extractImagesFromPodSpec', () => {
  it('collects containers, initContainers, and ephemeralContainers', () => {
    const spec: k8s.V1PodSpec = {
      containers: [{ name: 'a', image: 'img:a' }],
      initContainers: [{ name: 'i', image: 'img:b' }],
      ephemeralContainers: [{ name: 'e', image: 'img:a' }],
    };
    const { images, truncated } = extractImagesFromPodSpec(spec);
    expect(truncated).toBe(false);
    expect(images).toEqual(['img:a', 'img:b']);
  });

  it('dedupes within the spec and sorts', () => {
    const spec: k8s.V1PodSpec = {
      containers: [
        { name: 'x', image: 'z:1' },
        { name: 'y', image: 'a:1' },
      ],
    };
    expect(extractImagesFromPodSpec(spec).images).toEqual(['a:1', 'z:1']);
  });

  it('respects maxUnique for a single spec', () => {
    const spec: k8s.V1PodSpec = {
      containers: [
        { name: 'a', image: 'one:1' },
        { name: 'b', image: 'two:2' },
        { name: 'c', image: 'three:3' },
      ],
    };
    const { images, truncated } = extractImagesFromPodSpec(spec, { maxUnique: 2 });
    expect(truncated).toBe(true);
    expect(images.length).toBeLessThanOrEqual(2);
  });
});
