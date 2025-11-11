/**
 * kube9-operator entry point
 */

import { kubernetesClient } from './kubernetes/client.js';
import { loadConfig, setConfig, getConfig } from './config/loader.js';
import type { Config } from './config/types.js';
import { StatusWriter } from './status/writer.js';
import { RegistrationManager } from './registration/manager.js';
import { RegistrationClient } from './registration/client.js';
import { generateClusterIdentifier } from './cluster/identifier.js';
import { startHealthServer } from './health/server.js';
import { setInitialized } from './health/state.js';

console.log('kube9-operator starting...');

// Load configuration
async function initializeConfig(): Promise<Config> {
  try {
    console.log('Loading configuration...');
    const config = await loadConfig();
    setConfig(config);
    
    // Log config loaded (without sensitive data)
    console.log('Configuration loaded:');
    console.log(`  Server URL: ${config.serverUrl}`);
    console.log(`  Log Level: ${config.logLevel}`);
    console.log(`  Status Update Interval: ${config.statusUpdateIntervalSeconds}s`);
    console.log(`  Re-registration Interval: ${config.reregistrationIntervalHours}h`);
    console.log(`  API Key: ${config.apiKey ? 'configured (pro tier)' : 'not configured (free tier)'}`);
    
    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to load configuration:', errorMessage);
    throw error;
  }
}

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

// Initialize and run
async function main() {
  try {
    // Load config first
    const config = await initializeConfig();
    
    // Start health server early so probes are available during initialization
    startHealthServer(8080);
    
    // Test Kubernetes client
    await testKubernetesClient();
    
    // Initialize registration manager if API key is present
    let registrationManager: RegistrationManager | null = null;
    if (config.apiKey) {
      console.log('Initializing registration manager...');
      const registrationClient = new RegistrationClient(
        config.serverUrl,
        config.apiKey
      );
      registrationManager = new RegistrationManager(
        config,
        registrationClient,
        generateClusterIdentifier,
        () => kubernetesClient.getClusterInfo()
      );
      
      // Start registration (non-blocking)
      registrationManager.start().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to start registration: ${errorMessage}`);
        // Continue running even if registration fails initially
      });
    }
    
    // Start status writer for periodic ConfigMap updates
    console.log('Starting status writer...');
    const statusWriter = new StatusWriter(
      kubernetesClient,
      config.statusUpdateIntervalSeconds,
      registrationManager ?? undefined
    );
    statusWriter.start();
    
    // Mark operator as initialized - readiness probe will now pass
    setInitialized(true);
    
    console.log('kube9-operator initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize operator:', errorMessage);
    process.exit(1);
  }
}

// Run initialization
main().catch((error) => {
  console.error('Unexpected error during initialization:', error);
  process.exit(1);
});

// Export config singleton
export { getConfig };
export type { Config };

