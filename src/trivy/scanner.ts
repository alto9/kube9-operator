/**
 * Trivy image scanner using the documented CLI client/server path:
 * `trivy image --server <url> --format json <imageRef>`
 */

import { spawn } from 'node:child_process';
import { logger } from '../logging/logger.js';
import { trivyStatusTracker } from './state.js';
import type { TrivyStatus } from '../status/types.js';

/** Minimal shape of `trivy image -f json` output */
export interface TrivyImageReport {
  SchemaVersion?: number;
  ArtifactName?: string;
  Results?: unknown[];
  [key: string]: unknown;
}

export type TrivyScanFailureCode =
  | 'TRIVY_NOT_DETECTED'
  | 'TRIVY_CLI_FAILED'
  | 'TRIVY_SCAN_TIMEOUT'
  | 'TRIVY_SCAN_PARSE';

export class TrivyScanFailure extends Error {
  readonly code: TrivyScanFailureCode;
  readonly exitCode: number | null;

  constructor(
    code: TrivyScanFailureCode,
    message: string,
    options?: { exitCode?: number | null; cause?: unknown }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'TrivyScanFailure';
    this.code = code;
    this.exitCode = options?.exitCode ?? null;
  }
}

export interface TrivyScannerOptions {
  /** Remote Trivy server URL (must match detection) */
  serverUrl: string;
  /** Path to trivy binary (default: trivy) */
  cliPath?: string;
  /** Total timeout for a single scan attempt */
  scanTimeoutMs?: number;
  /** Retries on spawn/timeout failures (not on non-zero exit with output) */
  maxAttempts?: number;
  /** Override `child_process.spawn` (for tests) */
  spawnImpl?: typeof spawn;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTrivyOnce(
  imageRef: string,
  serverUrl: string,
  cliPath: string,
  timeoutMs: number,
  spawnImpl: TrivyScannerOptions['spawnImpl']
): Promise<string> {
  const spawnFn = spawnImpl ?? spawn;
  return new Promise((resolve, reject) => {
    const proc = spawnFn(
      cliPath,
      ['image', '--server', serverUrl, '--format', 'json', '--quiet', imageRef],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      }
    );

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new TrivyScanFailure('TRIVY_SCAN_TIMEOUT', `Trivy scan timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(
        new TrivyScanFailure('TRIVY_CLI_FAILED', `Failed to spawn Trivy CLI: ${err.message}`, {
          cause: err,
        })
      );
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new TrivyScanFailure(
            'TRIVY_CLI_FAILED',
            stderr.trim() || `trivy exited with code ${code}`,
            { exitCode: code }
          )
        );
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Scan a container image reference using the Trivy CLI against a remote server.
 * Does not run unless the caller provides a server URL (typically after detection).
 */
export async function scanContainerImage(
  imageRef: string,
  options: TrivyScannerOptions
): Promise<TrivyImageReport> {
  const cliPath = options.cliPath ?? process.env.TRIVY_CLI_PATH ?? 'trivy';
  const scanTimeoutMs = options.scanTimeoutMs ?? parseInt(process.env.TRIVY_SCAN_TIMEOUT_MS || '600000', 10);
  const maxAttempts = options.maxAttempts ?? 3;
  const spawnImpl = options.spawnImpl;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await runTrivyOnce(
        imageRef,
        options.serverUrl,
        cliPath,
        scanTimeoutMs,
        spawnImpl
      );
      try {
        return JSON.parse(raw) as TrivyImageReport;
      } catch (err) {
        throw new TrivyScanFailure('TRIVY_SCAN_PARSE', 'Failed to parse Trivy JSON output', {
          cause: err,
        });
      }
    } catch (err) {
      lastError = err;
      const retryable = err instanceof TrivyScanFailure && err.code === 'TRIVY_SCAN_TIMEOUT';

      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      const backoffMs = 1000 * 2 ** (attempt - 1);
      logger.warn('Trivy scan attempt failed, retrying', {
        attempt,
        maxAttempts,
        backoffMs,
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new TrivyScanFailure('TRIVY_CLI_FAILED', String(lastError));
}

/**
 * Runs a container image scan only when the tracker reports a detected Trivy server.
 */
export async function scanContainerImageWhenDetected(
  imageRef: string,
  options: Omit<TrivyScannerOptions, 'serverUrl'> & {
    getStatus?: () => TrivyStatus;
  }
): Promise<TrivyImageReport> {
  const status = options.getStatus?.() ?? trivyStatusTracker.getStatus();
  if (!status.detected || !status.serverUrl) {
    throw new TrivyScanFailure(
      'TRIVY_NOT_DETECTED',
      'Trivy server is not detected or unavailable; skipping scan'
    );
  }
  return scanContainerImage(imageRef, {
    cliPath: options.cliPath,
    scanTimeoutMs: options.scanTimeoutMs,
    maxAttempts: options.maxAttempts,
    spawnImpl: options.spawnImpl,
    serverUrl: status.serverUrl,
  });
}
