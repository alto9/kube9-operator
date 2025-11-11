import { createHash } from 'crypto';
import { kubernetesClient } from '../kubernetes/client.js';

/**
 * Generate a unique, deterministic cluster identifier
 * 
 * Creates a SHA256 hash of the cluster CA certificate (if available) or
 * the server URL (as fallback). The identifier is deterministic (same cluster
 * always produces same identifier) and non-reversible (cannot extract original
 * data from the hash).
 * 
 * @returns Cluster identifier in format: sha256:<64-hex-characters>
 * @throws Error if cluster information cannot be retrieved
 */
export function generateClusterIdentifier(): string {
  const kubeConfig = kubernetesClient.getKubeConfig();
  const cluster = kubeConfig.getCurrentCluster();
  
  if (!cluster) {
    throw new Error('No current cluster found in KubeConfig');
  }
  
  // Prefer CA certificate for identifier (more stable and unique)
  if (cluster.caData) {
    const hash = createHash('sha256')
      .update(cluster.caData)
      .digest('hex');
    return `sha256:${hash}`;
  }
  
  // Fallback to server URL if CA certificate is not available
  if (!cluster.server) {
    throw new Error('Cluster has neither caData nor server URL');
  }
  
  const hash = createHash('sha256')
    .update(cluster.server)
    .digest('hex');
  return `sha256:${hash}`;
}

