/**
 * Secret detection heuristics for security audit checks.
 *
 * Used by secrets-in-configmaps, hardcoded-secrets, and related checks.
 * Avoids false positives by excluding common placeholder values.
 */

/** Case-insensitive key patterns that suggest sensitive data */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'token',
  'secret',
  'api_key',
  'apikey',
  'auth',
  'credentials',
  'private_key',
  'privatekey',
] as const;

/** Placeholder values that should NOT be flagged as secrets (avoid false positives) */
const PLACEHOLDER_VALUES = new Set([
  '',
  'changeme',
  'change_me',
  'change-me',
  'placeholder',
  'xxx',
  'yyy',
  'secret',
  '<secret>',
  'your-secret-here',
  'your_password_here',
  'replace-me',
  'replace_me',
  'tbd',
  'todo',
  'none',
  'null',
  'test',
  'dummy',
  'sample',
  'example',
  'default',
]);

/**
 * Check if a key name suggests sensitive data (case-insensitive).
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Check if a value is a known placeholder (should not be flagged as secret).
 */
export function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (PLACEHOLDER_VALUES.has(trimmed)) {
    return true;
  }
  if (trimmed.length <= 3 && /^[x*._-]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Check if a value looks like a real secret (non-placeholder).
 * Used for ConfigMap data and binaryData values.
 */
export function looksLikeSecretValue(value: string): boolean {
  if (!value || value.length < 4) {
    return false;
  }
  if (isPlaceholderValue(value)) {
    return false;
  }
  return true;
}

/**
 * Check if a base64-encoded value decodes to something that looks like a secret.
 * Returns true if decode succeeds and decoded content looks non-placeholder.
 */
export function base64LooksLikeSecret(encoded: string): boolean {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    if (!decoded || decoded.length < 4) {
      return false;
    }
    if (isPlaceholderValue(decoded)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an env var value looks like a hardcoded secret.
 * Requires: key is sensitive, value is set (not valueFrom), value is non-placeholder.
 */
export function looksLikeHardcodedSecret(key: string, value: string): boolean {
  if (!isSensitiveKey(key)) {
    return false;
  }
  if (!value || value.length < 8) {
    return false;
  }
  if (isPlaceholderValue(value)) {
    return false;
  }
  return true;
}
