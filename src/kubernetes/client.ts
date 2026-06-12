import * as k8s from '@kubernetes/client-node';
import { existsSync } from 'fs';
import { logger } from '../logging/logger.js';

/**
 * Cluster information returned by getClusterInfo()
 */
export interface ClusterInfo {
  version: string;
  nodeCount: number;
}

/**
 * Kubernetes client for interacting with the cluster API
 * 
 * Uses in-cluster configuration when running as a pod.
 * Falls back to default kubeconfig (from KUBECONFIG env var or ~/.kube/config) for local development.
 * Provides CoreV1Api, VersionApi, AppsV1Api, PolicyV1Api, NetworkingV1Api,
 * AutoscalingV2Api, ApiextensionsV1Api, CustomObjectsApi, and RbacAuthorizationV1Api clients
 * for cluster operations.
 */
export class KubernetesClient {
  private kubeConfig: k8s.KubeConfig;
  public readonly coreApi: k8s.CoreV1Api;
  public readonly versionApi: k8s.VersionApi;
  public readonly appsApi: k8s.AppsV1Api;
  public readonly policyApi: k8s.PolicyV1Api;
  public readonly networkingApi: k8s.NetworkingV1Api;
  public readonly autoscalingApi: k8s.AutoscalingV2Api;
  public readonly apiextensionsApi: k8s.ApiextensionsV1Api;
  public readonly customObjectsApi: k8s.CustomObjectsApi;
  public readonly rbacApi: k8s.RbacAuthorizationV1Api;

  constructor() {
    try {
      // Initialize KubeConfig
      this.kubeConfig = new k8s.KubeConfig();
      
      // Check if we're running in-cluster by checking for service account files
      const inClusterTokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
      const inClusterCAPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
      const isInCluster = existsSync(inClusterTokenPath) && existsSync(inClusterCAPath);
      
      if (isInCluster) {
        // Load in-cluster configuration (for production/in-cluster deployment)
        try {
          this.kubeConfig.loadFromCluster();
          logger.info('Loaded Kubernetes config from cluster (in-cluster mode)');
        } catch (inClusterError) {
          const errorMessage = inClusterError instanceof Error ? inClusterError.message : String(inClusterError);
          logger.error('Failed to load in-cluster config', { error: errorMessage });
          throw new Error(`Kubernetes client initialization failed: Could not load in-cluster config. ${errorMessage}`);
        }
      } else {
        // Load from default kubeconfig (for local development)
        try {
          this.kubeConfig.loadFromDefault();
          logger.info('Loaded Kubernetes config from default kubeconfig (local development mode)');
        } catch (defaultError) {
          const errorMessage = defaultError instanceof Error ? defaultError.message : String(defaultError);
          logger.error('Failed to load Kubernetes config from default kubeconfig', {
            error: errorMessage
          });
          throw new Error(`Kubernetes client initialization failed: Could not load config from default kubeconfig. ${errorMessage}`);
        }
      }

      // Create API clients
      this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
      this.versionApi = this.kubeConfig.makeApiClient(k8s.VersionApi);
      this.appsApi = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
      this.policyApi = this.kubeConfig.makeApiClient(k8s.PolicyV1Api);
      this.networkingApi = this.kubeConfig.makeApiClient(k8s.NetworkingV1Api);
      this.autoscalingApi = this.kubeConfig.makeApiClient(k8s.AutoscalingV2Api);
      this.apiextensionsApi = this.kubeConfig.makeApiClient(k8s.ApiextensionsV1Api);
      this.customObjectsApi = this.kubeConfig.makeApiClient(k8s.CustomObjectsApi);
      this.rbacApi = this.kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize Kubernetes client', { error: errorMessage });
      throw new Error(`Kubernetes client initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Get cluster information including version and node count
   * 
   * @returns Promise resolving to cluster info with version and node count
   * @throws Error if cluster is unreachable or API calls fail
   */
  async getClusterInfo(): Promise<ClusterInfo> {
    try {
      // Get Kubernetes version
      const versionInfo = await this.versionApi.getCode();
      const version = versionInfo.gitVersion || 'unknown';

      // Get node count
      const nodeList = await this.coreApi.listNode();
      const nodeCount = nodeList.items?.length || 0;

      return {
        version,
        nodeCount
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get cluster info: ${errorMessage}`);
    }
  }

  /**
   * Get the underlying KubeConfig instance
   * Useful for accessing cluster CA data (e.g., for cluster identifier generation)
   */
  getKubeConfig(): k8s.KubeConfig {
    return this.kubeConfig;
  }
}

let kubernetesClientSingleton: KubernetesClient | undefined;

/** Properties assigned on `kubernetesClient` (e.g. test mocks) override delegation until cleared. */
let kubernetesClientProxyOverrides: Record<string | symbol, unknown> = {};

function hasKubernetesClientOverride(prop: string | symbol): boolean {
  return Object.prototype.hasOwnProperty.call(kubernetesClientProxyOverrides, prop);
}

/**
 * Returns the process-wide Kubernetes client, constructing it on first use.
 * Prefer importing `kubernetesClient` unless you need explicit lazy access.
 */
export function getKubernetesClient(): KubernetesClient {
  if (!kubernetesClientSingleton) {
    kubernetesClientSingleton = new KubernetesClient();
  }
  return kubernetesClientSingleton;
}

/**
 * Clears the lazy singleton and any properties assigned onto `kubernetesClient` (used by unit tests).
 */
export function resetKubernetesClientForTests(): void {
  kubernetesClientSingleton = undefined;
  kubernetesClientProxyOverrides = {};
}

/**
 * Singleton Kubernetes client — lazily initialized on first property access so importing this module
 * does not require a valid kubeconfig (e.g. Vitest without a cluster context).
 */
export const kubernetesClient = new Proxy({} as KubernetesClient, {
  get(_target, prop, _receiver) {
    if (hasKubernetesClientOverride(prop)) {
      return kubernetesClientProxyOverrides[prop];
    }
    const client = getKubernetesClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
  set(_target, prop, value) {
    kubernetesClientProxyOverrides[prop] = value;
    return true;
  },
});

