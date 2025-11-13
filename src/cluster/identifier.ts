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

/**
 * Generate a cluster identifier for collection payloads
 * 
 * Creates a SHA256 hash of the cluster CA certificate (if available) or
 * the server URL (as fallback). Formats the identifier as `cls_[32-char-hash]`
 * for use in collection payloads.
 * 
 * @returns Cluster identifier in format: cls_[32-char-hash]
 * @throws Error if cluster information cannot be retrieved
 */
export function generateClusterIdForCollection(): string {
  const kubeConfig = kubernetesClient.getKubeConfig();
  const cluster = kubeConfig.getCurrentCluster();
  
  if (!cluster) {
    throw new Error('No current cluster found in KubeConfig');
  }
  
  // Prefer CA certificate for identifier (more stable and unique)
  let hashInput: string;
  if (cluster.caData) {
    hashInput = cluster.caData;
  } else if (cluster.server) {
    // Fallback to server URL if CA certificate is not available
    hashInput = cluster.server;
  } else {
    throw new Error('Cluster has neither caData nor server URL');
  }
  
  // Generate 32-character hash and format as cls_[hash]
  const hash = createHash('sha256')
    .update(hashInput)
    .digest('hex')
    .substring(0, 32);
  
  return `cls_${hash}`;
}

