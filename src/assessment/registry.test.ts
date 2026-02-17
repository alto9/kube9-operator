import { describe, it, expect, beforeEach } from 'vitest';
import type { AssessmentCheck, AssessmentRunContext, AssessmentCheckResult } from './types.js';
import { Pillar, CheckStatus } from './types.js';
import {
  getRegistry,
  resetRegistry,
  validateCheck,
  DuplicateCheckIdError,
  InvalidCheckMetadataError,
} from './registry.js';

/** Creates a valid mock check for testing */
function createMockCheck(overrides: Partial<AssessmentCheck> = {}): AssessmentCheck {
  return {
    id: 'security.test-check',
    name: 'Test Security Check',
    pillar: Pillar.Security,
    description: 'A test check',
    run: async (): Promise<AssessmentCheckResult> => ({
      checkId: 'security.test-check',
      pillar: Pillar.Security,
      status: CheckStatus.Passing,
      message: 'OK',
    }),
    ...overrides,
  };
}

describe('assessment registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe('validateCheck', () => {
    it('returns valid for a complete check', () => {
      const result = validateCheck(createMockCheck());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid when id is empty', () => {
      const result = validateCheck(createMockCheck({ id: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('id must be a non-empty string');
    });

    it('returns invalid when id is whitespace only', () => {
      const result = validateCheck(createMockCheck({ id: '   ' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('id must be a non-empty string');
    });

    it('returns invalid when name is empty', () => {
      const result = validateCheck(createMockCheck({ name: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name must be a non-empty string');
    });

    it('returns invalid when pillar is invalid', () => {
      const result = validateCheck(
        createMockCheck({ pillar: 'invalid-pillar' as Pillar }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('pillar'))).toBe(true);
    });

    it('returns invalid when run is not a function', () => {
      const result = validateCheck(
        createMockCheck({ run: 'not-a-function' as unknown as AssessmentCheck['run'] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('run must be a function');
    });

    it('returns invalid when run is undefined', () => {
      const check = createMockCheck();
      delete (check as { run?: unknown }).run;
      const result = validateCheck(check);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('run must be a function');
    });
  });

  describe('register', () => {
    it('registers a valid check', () => {
      const reg = getRegistry();
      const check = createMockCheck();
      reg.register(check);
      expect(reg.size).toBe(1);
      expect(reg.getById('security.test-check')).toBe(check);
    });

    it('throws DuplicateCheckIdError when registering duplicate id', () => {
      const reg = getRegistry();
      reg.register(createMockCheck({ id: 'dup.id' }));
      expect(() => reg.register(createMockCheck({ id: 'dup.id', name: 'Other' }))).toThrow(
        DuplicateCheckIdError,
      );
      expect(() => reg.register(createMockCheck({ id: 'dup.id', name: 'Other' }))).toThrow(
        "Duplicate check id: 'dup.id'",
      );
    });

    it('throws InvalidCheckMetadataError when check has invalid metadata', () => {
      const reg = getRegistry();
      expect(() => reg.register(createMockCheck({ id: '' }))).toThrow(
        InvalidCheckMetadataError,
      );
      expect(() => reg.register(createMockCheck({ id: '' }))).toThrow(
        /Invalid check metadata for/,
      );
    });
  });

  describe('getAllChecks', () => {
    it('returns empty array when no checks registered', () => {
      const reg = getRegistry();
      expect(reg.getAllChecks()).toEqual([]);
    });

    it('returns all checks in deterministic order by id', () => {
      const reg = getRegistry();
      reg.register(createMockCheck({ id: 'security.b' }));
      reg.register(createMockCheck({ id: 'security.a' }));
      reg.register(createMockCheck({ id: 'reliability.c', pillar: Pillar.Reliability }));
      const all = reg.getAllChecks();
      expect(all).toHaveLength(3);
      expect(all.map((c) => c.id)).toEqual(['reliability.c', 'security.a', 'security.b']);
    });
  });

  describe('getByPillar', () => {
    it('returns empty array when no checks for pillar', () => {
      const reg = getRegistry();
      reg.register(createMockCheck({ id: 'security.only', pillar: Pillar.Security }));
      expect(reg.getByPillar(Pillar.Reliability)).toEqual([]);
    });

    it('returns only checks for the given pillar', () => {
      const reg = getRegistry();
      reg.register(createMockCheck({ id: 'security.a', pillar: Pillar.Security }));
      reg.register(createMockCheck({ id: 'reliability.b', pillar: Pillar.Reliability }));
      reg.register(createMockCheck({ id: 'security.c', pillar: Pillar.Security }));
      const security = reg.getByPillar(Pillar.Security);
      expect(security).toHaveLength(2);
      expect(security.map((c) => c.id).sort()).toEqual(['security.a', 'security.c']);
    });

    it('returns checks in deterministic order by id', () => {
      const reg = getRegistry();
      reg.register(createMockCheck({ id: 'security.z', pillar: Pillar.Security }));
      reg.register(createMockCheck({ id: 'security.a', pillar: Pillar.Security }));
      const security = reg.getByPillar(Pillar.Security);
      expect(security.map((c) => c.id)).toEqual(['security.a', 'security.z']);
    });
  });

  describe('getById', () => {
    it('returns undefined when check not found', () => {
      const reg = getRegistry();
      expect(reg.getById('nonexistent')).toBeUndefined();
    });

    it('returns the check when found', () => {
      const reg = getRegistry();
      const check = createMockCheck({ id: 'security.found' });
      reg.register(check);
      expect(reg.getById('security.found')).toBe(check);
    });
  });

  describe('bootstrap', () => {
    it('registers multiple checks', () => {
      const reg = getRegistry();
      reg.bootstrap([
        createMockCheck({ id: 'a' }),
        createMockCheck({ id: 'b' }),
        createMockCheck({ id: 'c' }),
      ]);
      expect(reg.size).toBe(3);
      expect(reg.getById('a')).toBeDefined();
      expect(reg.getById('b')).toBeDefined();
      expect(reg.getById('c')).toBeDefined();
    });

    it('fails fast on first invalid check', () => {
      const reg = getRegistry();
      expect(() =>
        reg.bootstrap([
          createMockCheck({ id: 'valid' }),
          createMockCheck({ id: 'invalid', name: '' }),
          createMockCheck({ id: 'never-reached' }),
        ]),
      ).toThrow(InvalidCheckMetadataError);
      expect(reg.size).toBe(1);
    });

    it('fails fast on first duplicate id', () => {
      const reg = getRegistry();
      expect(() =>
        reg.bootstrap([
          createMockCheck({ id: 'dup' }),
          createMockCheck({ id: 'dup', name: 'Second' }),
        ]),
      ).toThrow(DuplicateCheckIdError);
      expect(reg.size).toBe(1);
    });
  });

  describe('resetRegistry', () => {
    it('clears the registry and allows fresh registration', () => {
      const reg = getRegistry();
      reg.register(createMockCheck({ id: 'before-reset' }));
      expect(reg.size).toBe(1);
      resetRegistry();
      const reg2 = getRegistry();
      expect(reg2.size).toBe(0);
      reg2.register(createMockCheck({ id: 'before-reset' }));
      expect(reg2.size).toBe(1);
    });
  });
});
