/**
 * kube9-operator entry point
 */

import { kubernetesClient } from './kubernetes/client.js';

console.log('kube9-operator starting...');

// Test Kubernetes client initialization
async function testKubernetesClient() {
  try {
    console.log('Testing Kubernetes client...');
    
    const clusterInfo = await kubernetesClient.getClusterInfo();
    console.log('Cluster info retrieved successfully:');
    console.log(`  Kubernetes version: ${clusterInfo.version}`);
    console.log(`  Node count: ${clusterInfo.nodeCount}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to connect to Kubernetes cluster:', errorMessage);
    console.error('This is expected if running outside a cluster. The operator will retry when deployed.');
  }
}

// Run test
testKubernetesClient().catch((error) => {
  console.error('Unexpected error during client test:', error);
});

