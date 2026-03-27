import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SchemaManager } from './schema.js';
import { DatabaseManager } from './manager.js';
import { ImageScanRepository } from './image-scan-repository.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const testDbDir = path.join(process.cwd(), 'test-image-scan-temp');

describe('ImageScanRepository', () => {
  beforeAll(() => {
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    mkdirSync(testDbDir, { recursive: true });
    process.env.DB_PATH = testDbDir;
  });

  afterAll(() => {
    DatabaseManager.reset();
    if (existsSync(testDbDir)) {
      rmSync(testDbDir, { recursive: true, force: true });
    }
    delete process.env.DB_PATH;
  });

  beforeEach(() => {
    DatabaseManager.reset();
    const dbPath = path.join(testDbDir, 'kube9.db');
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
    const schema = new SchemaManager();
    schema.initialize();
  });

  afterEach(() => {
    DatabaseManager.reset();
  });

  it('stores and retrieves scans with filters', () => {
    const repo = new ImageScanRepository();
    const t0 = '2026-01-01T00:00:00.000Z';
    const t1 = '2026-01-15T12:00:00.000Z';
    repo.upsertScan({
      scan_id: 'scan-a',
      image_reference: 'docker.io/library/nginx:1.25',
      started_at: t0,
      completed_at: t1,
      state: 'completed',
      scanner: 'trivy',
    });
    repo.upsertScan({
      scan_id: 'scan-b',
      image_reference: 'gcr.io/foo/bar:v2',
      started_at: '2026-02-01T00:00:00.000Z',
      state: 'failed',
      scanner: 'trivy',
      error_message: 'timeout',
    });

    expect(repo.getScanById('scan-a')?.image_reference).toBe('docker.io/library/nginx:1.25');
    const byRef = repo.queryScans({
      filters: { image_reference: 'docker.io/library/nginx:1.25' },
    });
    expect(byRef).toHaveLength(1);

    const contains = repo.queryScans({
      filters: { image_reference_contains: 'nginx' },
    });
    expect(contains.map((s) => s.scan_id)).toContain('scan-a');

    const inRange = repo.queryScans({
      filters: { completed_from: '2026-01-10T00:00:00.000Z', completed_to: '2026-01-20T00:00:00.000Z' },
    });
    expect(inRange.map((s) => s.scan_id)).toEqual(['scan-a']);

    expect(repo.countScans({ state: 'failed' })).toBe(1);
  });

  it('replaces vulnerabilities and filters by severity and time', () => {
    const repo = new ImageScanRepository();
    const started = '2026-03-01T10:00:00.000Z';
    const completed = '2026-03-01T10:05:00.000Z';
    repo.upsertScan({
      scan_id: 'scan-1',
      image_reference: 'alpine:3',
      started_at: started,
      completed_at: completed,
      state: 'completed',
      scanner: 'trivy',
    });
    repo.replaceVulnerabilitiesForScan('scan-1', [
      {
        id: 'v1',
        scan_id: 'scan-1',
        vulnerability_id: 'CVE-2024-1',
        severity: 'HIGH',
        title: 'test',
      },
      {
        id: 'v2',
        scan_id: 'scan-1',
        vulnerability_id: 'CVE-2024-2',
        severity: 'LOW',
      },
    ]);

    expect(repo.countVulnerabilities({ scan_id: 'scan-1' })).toBe(2);
    const highs = repo.queryVulnerabilities({
      filters: { severity: 'HIGH', completed_from: '2026-03-01T00:00:00.000Z' },
    });
    expect(highs).toHaveLength(1);
    expect(highs[0]?.vulnerability_id).toBe('CVE-2024-1');

    repo.replaceVulnerabilitiesForScan('scan-1', [
      {
        id: 'v3',
        scan_id: 'scan-1',
        vulnerability_id: 'CVE-2024-3',
        severity: 'CRITICAL',
      },
    ]);
    expect(repo.countVulnerabilities({ scan_id: 'scan-1' })).toBe(1);
  });

  it('cascades deletes when removing a scan', () => {
    const repo = new ImageScanRepository();
    repo.upsertScan({
      scan_id: 'scan-c',
      image_reference: 'x:y',
      started_at: new Date().toISOString(),
      state: 'completed',
      scanner: 'trivy',
    });
    repo.insertVulnerabilities([
      {
        id: 'row1',
        scan_id: 'scan-c',
        vulnerability_id: 'CVE-1',
        severity: 'MEDIUM',
      },
    ]);
    expect(repo.countVulnerabilities({ scan_id: 'scan-c' })).toBe(1);
    repo.deleteScan('scan-c');
    expect(repo.getScanById('scan-c')).toBeNull();
    expect(repo.countVulnerabilities({ scan_id: 'scan-c' })).toBe(0);
  });

  it('deleteScansCompletedBefore removes old completed scans', () => {
    const repo = new ImageScanRepository();
    repo.upsertScan({
      scan_id: 'old',
      image_reference: 'a:b',
      started_at: '2020-01-01T00:00:00.000Z',
      completed_at: '2020-01-02T00:00:00.000Z',
      state: 'completed',
      scanner: 'trivy',
    });
    repo.upsertScan({
      scan_id: 'new',
      image_reference: 'c:d',
      started_at: '2026-01-01T00:00:00.000Z',
      completed_at: '2026-01-02T00:00:00.000Z',
      state: 'completed',
      scanner: 'trivy',
    });
    const n = repo.deleteScansCompletedBefore('2025-01-01T00:00:00.000Z');
    expect(n).toBe(1);
    expect(repo.getScanById('old')).toBeNull();
    expect(repo.getScanById('new')).not.toBeNull();
  });

  it('empty repository returns no rows', () => {
    const repo = new ImageScanRepository();
    expect(repo.queryScans()).toEqual([]);
    expect(repo.queryVulnerabilities()).toEqual([]);
    expect(repo.countScans()).toBe(0);
    expect(repo.countVulnerabilities()).toBe(0);
  });
});
