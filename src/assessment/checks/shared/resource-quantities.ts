/**
 * Shared Kubernetes resource quantity parsing for assessment checks.
 * Aligns CPU and memory string forms with workload resource evaluation.
 */

/**
 * Parse a Kubernetes CPU quantity to fractional cores (e.g. "100m" -> 0.1, "2" -> 2).
 */
export function parseCpuCores(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.endsWith('m')) {
    const n = Number(raw.slice(0, -1));
    return Number.isFinite(n) ? n / 1000 : undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a Kubernetes memory quantity to bytes (supports Ki, Mi, Gi, bare bytes, etc.).
 */
export function parseMemoryBytes(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const match = raw.match(/^([0-9]*\.?[0-9]+)([a-zA-Z]+)?$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2] ?? '';

  const factors: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
    m: 0.001,
  };

  const factor = factors[unit];
  if (factor !== undefined) {
    return amount * factor;
  }
  if (!unit) {
    return amount;
  }
  return undefined;
}
