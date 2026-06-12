/**
 * Bounded errors for checklist loading and selection.
 */

export type ChecklistErrorCode =
  | 'unsupported_minor'
  | 'missing_checklist_file'
  | 'malformed_yaml'
  | 'invalid_checklist_document'
  | 'manifest_error';

export class ChecklistLoadError extends Error {
  readonly code: ChecklistErrorCode;
  readonly kubernetesMinor: string | null;

  constructor(
    code: ChecklistErrorCode,
    message: string,
    kubernetesMinor: string | null = null
  ) {
    super(message);
    this.name = 'ChecklistLoadError';
    this.code = code;
    this.kubernetesMinor = kubernetesMinor;
  }
}

const MAX_ISSUE_DETAIL_LENGTH = 120;

/**
 * Produce a bounded parser detail string suitable for conformance run failure text.
 */
export function boundChecklistErrorDetail(error: ChecklistLoadError): string {
  const prefix = error.kubernetesMinor
    ? `${error.code}:${error.kubernetesMinor}`
    : error.code;
  const detail = error.message.trim();
  const combined = detail ? `${prefix} - ${detail}` : prefix;
  return combined.length <= MAX_ISSUE_DETAIL_LENGTH
    ? combined
    : `${combined.slice(0, MAX_ISSUE_DETAIL_LENGTH - 3)}...`;
}
