import express, { type Express } from 'express';
import { checkLiveness, checkReadiness } from './checks.js';

/**
 * Health server instance
 */
let server: ReturnType<Express['listen']> | null = null;

/**
 * Start the health check HTTP server
 * 
 * Sets up Express server with /healthz (liveness) and /readyz (readiness) endpoints.
 * Server starts listening without blocking the main thread.
 * 
 * @param port - Port number to listen on (default: 8080)
 */
export function startHealthServer(port: number = 8080): void {
  if (server !== null) {
    console.warn('Health server is already running');
    return;
  }

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

  // Start server
  server = app.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });

  // Handle server errors gracefully
  server.on('error', (error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Health server error: ${errorMessage}`);
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

    console.log('Stopping health server...');
    server.close(() => {
      console.log('Health server stopped');
      server = null;
      resolve();
    });
  });
}

