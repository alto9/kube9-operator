import express, { type Express } from 'express';
import { checkLiveness, checkReadiness } from './checks.js';
import { getMetrics } from '../collection/metrics.js';
import { logger } from '../logging/logger.js';

/**
 * Health server instance
 */
let server: ReturnType<Express['listen']> | null = null;

/**
 * Options for the health server
 */
export interface HealthServerOptions {
  /** Port number to listen on (default: 8080) */
  port: number;
  /** Path for Prometheus metrics endpoint (default: /metrics) */
  metricsPath?: string;
}

/**
 * Start the health check HTTP server
 *
 * Sets up Express server with /healthz (liveness) and /readyz (readiness) endpoints.
 * Server starts listening without blocking the main thread.
 *
 * @param portOrOptions - Port number (default: 8080) or options object
 */
export function startHealthServer(portOrOptions: number | HealthServerOptions = 8080): void {
  if (server !== null) {
    logger.warn('Health server is already running');
    return;
  }

  const port =
    typeof portOrOptions === 'number' ? portOrOptions : portOrOptions.port;
  const metricsPath =
    typeof portOrOptions === 'object' && portOrOptions.metricsPath
      ? portOrOptions.metricsPath
      : '/metrics';

  const app = express();

  // Liveness probe endpoint
  app.get('/healthz', async (req, res) => {
    try {
      const result = await checkLiveness();
      if (result.healthy) {
        res.status(200).send(result.message);
      } else {
        res.status(500).send(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).send(`Not healthy: ${errorMessage}`);
    }
  });

  // Readiness probe endpoint
  app.get('/readyz', async (req, res) => {
    try {
      const result = await checkReadiness();
      if (result.healthy) {
        res.status(200).send(result.message);
      } else {
        res.status(503).send(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(503).send(`Not ready: ${errorMessage}`);
    }
  });

  // Prometheus metrics endpoint
  app.get(metricsPath, async (req, res) => {
    try {
      const metrics = await getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to retrieve metrics', { error: errorMessage });
      res.status(500).send(`Error generating metrics: ${errorMessage}`);
    }
  });

  // Start server
  server = app.listen(port, () => {
    logger.info('Health server listening', { port });
  });

  // Handle server errors gracefully
  server.on('error', (error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Health server error', { error: errorMessage });
  });
}

/**
 * Stop the health check HTTP server
 * 
 * Closes the server connection. Used during graceful shutdown.
 */
export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server === null) {
      resolve();
      return;
    }

    logger.info('Stopping health server...');
    server.close(() => {
      logger.info('Health server stopped');
      server = null;
      resolve();
    });
  });
}

