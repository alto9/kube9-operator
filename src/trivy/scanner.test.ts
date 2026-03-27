import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { spawn as nodeSpawn } from 'node:child_process';
import {
  scanContainerImage,
  TrivyScanFailure,
} from './scanner.js';

function fakeSpawnSuccess(json: object): typeof nodeSpawn {
  return ((() => {
    const proc = new EventEmitter();
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    (proc as any).stdout = stdout;
    (proc as any).stderr = stderr;
    (proc as any).kill = vi.fn();

    queueMicrotask(() => {
      stdout.emit('data', Buffer.from(JSON.stringify(json)));
      proc.emit('close', 0);
    });

    return proc as any;
  }) as unknown) as typeof nodeSpawn;
}

describe('scanContainerImage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses JSON report from trivy CLI stdout', async () => {
    const report = await scanContainerImage('alpine:3', {
      serverUrl: 'http://127.0.0.1:4954',
      cliPath: 'trivy',
      scanTimeoutMs: 5000,
      maxAttempts: 1,
      spawnImpl: fakeSpawnSuccess({ SchemaVersion: 2, ArtifactName: 'alpine:3' }),
    });

    expect(report.SchemaVersion).toBe(2);
    expect(report.ArtifactName).toBe('alpine:3');
  });

  it('throws TrivyScanFailure on non-zero exit', async () => {
    const spawnImpl = ((() => {
      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      (proc as any).stdout = stdout;
      (proc as any).stderr = stderr;
      (proc as any).kill = vi.fn();

      queueMicrotask(() => {
        stderr.emit('data', Buffer.from('scan failed'));
        proc.emit('close', 1);
      });

      return proc as any;
    }) as unknown) as typeof nodeSpawn;

    await expect(
      scanContainerImage('bad:image', {
        serverUrl: 'http://127.0.0.1:4954',
        maxAttempts: 1,
        spawnImpl,
      })
    ).rejects.toMatchObject({
      code: 'TRIVY_CLI_FAILED',
    });
  });

  it('maps invalid JSON to TRIVY_SCAN_PARSE', async () => {
    const spawnImpl = ((() => {
      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      (proc as any).stdout = stdout;
      (proc as any).stderr = stderr;
      (proc as any).kill = vi.fn();

      queueMicrotask(() => {
        stdout.emit('data', Buffer.from('not-json'));
        proc.emit('close', 0);
      });

      return proc as any;
    }) as unknown) as typeof nodeSpawn;

    try {
      await scanContainerImage('alpine:3', {
        serverUrl: 'http://127.0.0.1:4954',
        maxAttempts: 1,
        spawnImpl,
      });
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TrivyScanFailure);
      expect((e as TrivyScanFailure).code).toBe('TRIVY_SCAN_PARSE');
    }
  });
});
