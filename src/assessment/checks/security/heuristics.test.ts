import { describe, it, expect } from 'vitest';
import {
  isSensitiveKey,
  isPlaceholderValue,
  looksLikeSecretValue,
  base64LooksLikeSecret,
  looksLikeHardcodedSecret,
} from './heuristics.js';

describe('heuristics', () => {
  describe('isSensitiveKey', () => {
    it('returns true for password', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('db_password')).toBe(true);
    });

    it('returns true for token', () => {
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('API_TOKEN')).toBe(true);
    });

    it('returns true for api_key, credentials, etc.', () => {
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('credentials')).toBe(true);
      expect(isSensitiveKey('private_key')).toBe(true);
    });

    it('returns false for non-sensitive keys', () => {
      expect(isSensitiveKey('host')).toBe(false);
      expect(isSensitiveKey('port')).toBe(false);
      expect(isSensitiveKey('database')).toBe(false);
    });
  });

  describe('isPlaceholderValue', () => {
    it('returns true for common placeholders', () => {
      expect(isPlaceholderValue('changeme')).toBe(true);
      expect(isPlaceholderValue('placeholder')).toBe(true);
      expect(isPlaceholderValue('xxx')).toBe(true);
      expect(isPlaceholderValue('your-secret-here')).toBe(true);
      expect(isPlaceholderValue('')).toBe(true);
    });

    it('returns false for non-placeholder values', () => {
      expect(isPlaceholderValue('myActualSecret123')).toBe(false);
      expect(isPlaceholderValue('sk-abc123xyz')).toBe(false);
    });
  });

  describe('looksLikeSecretValue', () => {
    it('returns false for short or empty values', () => {
      expect(looksLikeSecretValue('')).toBe(false);
      expect(looksLikeSecretValue('abc')).toBe(false);
    });

    it('returns false for placeholders', () => {
      expect(looksLikeSecretValue('changeme')).toBe(false);
      expect(looksLikeSecretValue('placeholder')).toBe(false);
    });

    it('returns true for non-placeholder values', () => {
      expect(looksLikeSecretValue('mySecretValue123')).toBe(true);
    });
  });

  describe('base64LooksLikeSecret', () => {
    it('returns false for placeholder base64', () => {
      expect(base64LooksLikeSecret(Buffer.from('changeme', 'utf-8').toString('base64'))).toBe(false);
    });

    it('returns true for non-placeholder base64', () => {
      expect(base64LooksLikeSecret(Buffer.from('realSecret123', 'utf-8').toString('base64'))).toBe(true);
    });
  });

  describe('looksLikeHardcodedSecret', () => {
    it('returns true for sensitive key with non-placeholder value', () => {
      expect(looksLikeHardcodedSecret('password', 'mySecurePass123')).toBe(true);
      expect(looksLikeHardcodedSecret('API_TOKEN', 'sk-abc123xyz456')).toBe(true);
    });

    it('returns false for sensitive key with placeholder', () => {
      expect(looksLikeHardcodedSecret('password', 'changeme')).toBe(false);
    });

    it('returns false for short values', () => {
      expect(looksLikeHardcodedSecret('password', 'short')).toBe(false);
    });

    it('returns false for non-sensitive key', () => {
      expect(looksLikeHardcodedSecret('HOST', 'mySecurePass123')).toBe(false);
    });
  });
});
