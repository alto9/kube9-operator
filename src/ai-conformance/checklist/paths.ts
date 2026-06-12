import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Resolve the checklist module directory that contains bundle-manifest.json and bundled/.
 */
export function resolveDefaultChecklistModuleRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Resolve checklist module root, preferring an explicit override when it exists.
 */
export function resolveChecklistModuleRoot(override?: string): string {
  if (override && existsSync(override)) {
    return override;
  }
  return resolveDefaultChecklistModuleRoot();
}

/**
 * Resolve the packaged checklist YAML directory for a module root.
 */
export function resolveBundledDir(moduleRoot: string): string {
  return join(moduleRoot, 'bundled');
}
