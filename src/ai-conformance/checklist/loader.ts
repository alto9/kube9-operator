import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { ZodError } from 'zod';
import {
  AiConformanceBundleManifestSchema,
  AiConformanceChecklistDocumentSchema,
} from './contracts.js';
import type { AiConformanceBundleManifest, AiConformanceChecklistDocument } from './contracts.js';
import { ChecklistLoadError } from './errors.js';
import { resolveBundledDir, resolveChecklistModuleRoot } from './paths.js';

function formatZodIssues(error: ZodError): string {
  const first = error.issues[0];
  if (!first) {
    return 'Checklist document failed validation.';
  }
  const path = first.path.length > 0 ? first.path.join('.') : 'root';
  return `Checklist document failed validation at "${path}": ${first.message}`;
}

/**
 * Load and validate the bundled checklist manifest.
 */
export function loadBundleManifest(bundleRoot?: string): AiConformanceBundleManifest {
  const moduleRoot = resolveChecklistModuleRoot(bundleRoot);
  const manifestPath = join(moduleRoot, 'bundle-manifest.json');

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch {
    throw new ChecklistLoadError(
      'manifest_error',
      'Bundled checklist manifest is missing or unreadable.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ChecklistLoadError(
      'manifest_error',
      'Bundled checklist manifest is not valid JSON.'
    );
  }

  try {
    return AiConformanceBundleManifestSchema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ChecklistLoadError('manifest_error', formatZodIssues(error));
    }
    throw error;
  }
}

/**
 * Parse and validate checklist YAML content.
 */
export function parseChecklistYaml(
  yamlContent: string,
  sourceLabel: string
): AiConformanceChecklistDocument {
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlContent);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Checklist YAML could not be parsed.';
    throw new ChecklistLoadError(
      'malformed_yaml',
      `Malformed checklist YAML in ${sourceLabel}: ${detail}`
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new ChecklistLoadError(
      'malformed_yaml',
      `Malformed checklist YAML in ${sourceLabel}: expected a document object.`
    );
  }

  try {
    return AiConformanceChecklistDocumentSchema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ChecklistLoadError(
        'invalid_checklist_document',
        formatZodIssues(error)
      );
    }
    throw error;
  }
}

/**
 * Load a checklist YAML file from the bundled directory.
 */
export function loadChecklistFile(
  filename: string,
  bundleRoot?: string
): AiConformanceChecklistDocument {
  const bundledDir = resolveBundledDir(resolveChecklistModuleRoot(bundleRoot));
  const filePath = join(bundledDir, filename);

  let yamlContent: string;
  try {
    yamlContent = readFileSync(filePath, 'utf8');
  } catch {
    throw new ChecklistLoadError(
      'missing_checklist_file',
      `Checklist file "${filename}" is missing from the operator bundle.`,
      null
    );
  }

  return parseChecklistYaml(yamlContent, filename);
}
