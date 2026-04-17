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
