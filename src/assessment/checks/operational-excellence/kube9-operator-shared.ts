/**
 * Shared helpers for kube9-operator observability assessment checks.
 */

import * as k8s from '@kubernetes/client-node';

/** Standard Helm/app label for kube9-operator workloads */
export const KUBE9_OPERATOR_APP_LABEL_VALUE = 'kube9-operator';

/** Preferred main container name from the official chart */
export const KUBE9_OPERATOR_CONTAINER_NAME = 'operator';

export function isKube9OperatorDeployment(d: k8s.V1Deployment): boolean {
  const name = d.metadata?.labels?.['app.kubernetes.io/name'];
  return name === KUBE9_OPERATOR_APP_LABEL_VALUE;
}

export function getOperatorContainer(
  podSpec: k8s.V1PodSpec | undefined
): k8s.V1Container | undefined {
  const containers = podSpec?.containers ?? [];
  if (containers.length === 0) return undefined;
  return (
    containers.find((c) => c.name === KUBE9_OPERATOR_CONTAINER_NAME) ?? containers[0]
  );
}

/**
 * Normalize IntOrString from probes (Kubernetes client may use intVal/strVal or a plain number).
 */
export function probeHttpPortValue(port: k8s.V1HTTPGetAction['port']): number | string | undefined {
  if (port === undefined || port === null) return undefined;
  /** IntOrString in @kubernetes/client-node is `number | string` */
  if (typeof port === 'number' || typeof port === 'string') return port;
  return undefined;
}

/** Whether the container declares a port matching the probe target (number or name). */
export function getContainerEnv(container: k8s.V1Container, name: string): k8s.V1EnvVar | undefined {
  return container.env?.find((e) => e.name === name);
}

/** Valid LOG_LEVEL values for src/logging/logger.ts (Winston). */
export const VALID_LOG_LEVELS = new Set(['error', 'warn', 'info', 'debug']);

export function normalizedLogLevel(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  return value.trim().toLowerCase();
}

/**
 * Whether the env var injects the pod namespace via the standard downward API
 * (required for correlating structured logs with Kubernetes metadata).
 */
export function isPodNamespaceFieldRef(envVar: k8s.V1EnvVar | undefined): boolean {
  if (!envVar?.valueFrom?.fieldRef) return false;
  return envVar.valueFrom.fieldRef.fieldPath === 'metadata.namespace';
}

export function containerDeclaresProbePort(
  httpGet: k8s.V1HTTPGetAction | undefined,
  container: k8s.V1Container
): boolean {
  if (!httpGet?.port) return false;
  const v = probeHttpPortValue(httpGet.port);
  if (v === undefined) return false;
  const ports = container.ports ?? [];
  if (typeof v === 'number') {
    return ports.some((cp) => cp.containerPort === v);
  }
  const n = Number(v);
  if (!Number.isNaN(n)) {
    return ports.some((cp) => cp.containerPort === n);
  }
  return ports.some((cp) => cp.name === v);
}
