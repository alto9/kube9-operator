/**
 * CLI Output Formatters - Convert data to JSON, YAML, or table format
 */

import * as yaml from 'js-yaml';

export function formatOutput(data: any, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);

    case 'yaml':
      return yaml.dump(data, { indent: 2, lineWidth: 120 });

    case 'table':
    case 'compact':
      return formatTable(data, format);

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function formatTable(data: any, format: string = 'table'): string {
  const isCompact = format === 'compact';

  // Handle events list
  if (data.events && Array.isArray(data.events)) {
    const headers = ['ID', 'TYPE', 'SEVERITY', 'TITLE', 'CREATED'];
    const rows = data.events.map((event: any) => [
      truncate(event.id, isCompact ? 20 : 28),
      event.event_type,
      event.severity,
      truncate(event.title, isCompact ? 30 : 40),
      formatDate(event.created_at),
    ]);
    return renderTable(headers, rows, isCompact);
  }

  // Handle assessments list
  if (data.assessments && Array.isArray(data.assessments)) {
    const headers = ['RUN_ID', 'MODE', 'STATE', 'TOTAL', 'PASSED', 'FAILED', 'REQUESTED'];
    const rows = data.assessments.map((a: any) => [
      truncate(a.run_id, isCompact ? 20 : 36),
      a.mode,
      a.state,
      String(a.total_checks),
      String(a.passed_checks),
      String(a.failed_checks),
      formatDate(a.requested_at),
    ]);
    return renderTable(headers, rows, isCompact);
  }

  // Handle assessment history list
  if (data.history && Array.isArray(data.history)) {
    const headers = ['ID', 'RUN_ID', 'CHECK_ID', 'PILLAR', 'STATUS', 'ASSESSED'];
    const rows = data.history.map((h: any) => [
      truncate(h.id, isCompact ? 24 : 36),
      truncate(h.run_id, isCompact ? 20 : 36),
      truncate(h.check_id, isCompact ? 24 : 40),
      h.pillar,
      h.status,
      formatDate(h.assessed_at),
    ]);
    return renderTable(headers, rows, isCompact);
  }

  // Handle single event, status, or assessment record
  if (typeof data === 'object' && !Array.isArray(data)) {
    return renderKeyValueTable(data);
  }

  // Fallback to JSON
  return JSON.stringify(data, null, 2);
}

function renderTable(headers: string[], rows: string[][], compact: boolean = false): string {
  if (rows.length === 0) {
    return 'No results found';
  }

  // Calculate column widths (cap in compact mode)
  const columnWidths = headers.map((h, i) => {
    const max = Math.max(h.length, ...rows.map(r => r[i]?.length || 0));
    return compact ? Math.min(max, 24) : max;
  });

  // Format header row
  const headerRow = headers
    .map((h, i) => truncate(h, columnWidths[i]).padEnd(columnWidths[i]))
    .join(compact ? ' ' : '  ');

  // Format separator
  const separator = columnWidths
    .map(w => '-'.repeat(w))
    .join(compact ? '-' : '--');

  // Format data rows
  const dataRows = rows
    .map(row =>
      row
        .map((cell, i) => truncate(String(cell), columnWidths[i]).padEnd(columnWidths[i]))
        .join(compact ? ' ' : '  ')
    )
    .join('\n');

  return `${headerRow}\n${separator}\n${dataRows}`;
}

function renderKeyValueTable(data: any): string {
  const entries = Object.entries(data);
  const maxKeyLength = Math.max(...entries.map(([k]) => k.length));
  
  return entries
    .map(([key, value]) => {
      const formattedKey = key.padEnd(maxKeyLength);
      const formattedValue = typeof value === 'object' 
        ? JSON.stringify(value) 
        : String(value);
      return `${formattedKey} : ${formattedValue}`;
    })
    .join('\n');
}

function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  return str.length > maxLength 
    ? str.substring(0, maxLength - 3) + '...' 
    : str;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

