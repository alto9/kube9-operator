import type { AiConformanceChecklistRequirement } from './checklist/contracts.js';
import type {
  AiConformanceCategorySummary,
  AiConformanceRequirementSummary,
  AiConformanceTotals,
  EvaluatedRequirementResult,
} from './contracts.js';
import { boundConformanceText } from './contracts.js';

export function buildTotalsFromResults(
  requirements: AiConformanceChecklistRequirement[],
  results: EvaluatedRequirementResult[]
): AiConformanceTotals {
  const levelCounts = { must: 0, should: 0 };
  for (const req of requirements) {
    if (req.level === 'MUST') {
      levelCounts.must++;
    } else {
      levelCounts.should++;
    }
  }

  const totals: AiConformanceTotals = {
    totalRequirements: requirements.length,
    mustRequirements: levelCounts.must,
    shouldRequirements: levelCounts.should,
    passed: 0,
    failed: 0,
    warning: 0,
    notApplicable: 0,
    notEvaluated: 0,
    needsEvidence: 0,
  };

  for (const result of results) {
    switch (result.status) {
      case 'passed':
        totals.passed++;
        break;
      case 'failed':
        totals.failed++;
        break;
      case 'warning':
        totals.warning++;
        break;
      case 'not-applicable':
        totals.notApplicable++;
        break;
      case 'not-evaluated':
        totals.notEvaluated++;
        break;
      case 'needs-evidence':
        totals.needsEvidence++;
        break;
    }
  }

  return totals;
}

export function buildCategoryRollups(
  results: EvaluatedRequirementResult[]
): Record<string, AiConformanceCategorySummary> {
  const categories: Record<string, AiConformanceCategorySummary> = {};

  for (const result of results) {
    const existing = categories[result.category] ?? {
      total: 0,
      passed: 0,
      failed: 0,
      warning: 0,
      notApplicable: 0,
      notEvaluated: 0,
      needsEvidence: 0,
    };
    existing.total++;
    switch (result.status) {
      case 'passed':
        existing.passed++;
        break;
      case 'failed':
        existing.failed++;
        break;
      case 'warning':
        existing.warning++;
        break;
      case 'not-applicable':
        existing.notApplicable++;
        break;
      case 'not-evaluated':
        existing.notEvaluated++;
        break;
      case 'needs-evidence':
        existing.needsEvidence++;
        break;
    }
    categories[result.category] = existing;
  }

  return categories;
}

export function buildBoundedRequirementSummaries(
  results: EvaluatedRequirementResult[]
): AiConformanceRequirementSummary[] {
  return results
    .map((row) => ({
      id: row.requirement_id,
      category: row.category,
      level: row.level,
      title: boundConformanceText(row.title),
      status: row.status,
      rationale: boundConformanceText(row.rationale),
      evidenceRef: row.evidence_ref ?? null,
    }))
    .sort((a, b) => {
      const byCategory = a.category.localeCompare(b.category);
      if (byCategory !== 0) {
        return byCategory;
      }
      return a.id.localeCompare(b.id);
    });
}
