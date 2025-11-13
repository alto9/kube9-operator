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
 * Provides CoreV1Api, VersionApi, and AppsV1Api clients for cluster operations.
 */
export class KubernetesClient {
  private kubeConfig: k8s.KubeConfig;
  public readonly coreApi: k8s.CoreV1Api;
  public readonly versionApi: k8s.VersionApi;
  public readonly appsApi: k8s.AppsV1Api;

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
      const version = versionInfo.body.gitVersion || 'unknown';

      // Get node count
      const nodeList = await this.coreApi.listNode();
      const nodeCount = nodeList.body.items?.length || 0;

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

/**
 * Singleton instance of KubernetesClient
 * Use this instance throughout the application for cluster interactions
 */
export const kubernetesClient = new KubernetesClient();

