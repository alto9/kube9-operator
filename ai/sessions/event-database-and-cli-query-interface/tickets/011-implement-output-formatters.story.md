---
story_id: 011-implement-output-formatters
session_id: event-database-and-cli-query-interface
feature_id: [cli-query-interface]
spec_id: [cli-architecture-spec]
status: completed
---

# Story: Implement Output Formatters (JSON, YAML, Table)

## Objective

Create output formatters that convert query results to JSON, YAML, or human-readable table format.

## Acceptance Criteria

- [ ] `formatOutput()` function handles json, yaml, table formats
- [ ] JSON format is pretty-printed with 2-space indentation
- [ ] YAML format uses proper indentation
- [ ] Table format renders aligned columns with headers
- [ ] Table truncates long strings for readability
- [ ] Handles both single objects and arrays

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/cli/formatters.ts`

## Implementation Notes

### Formatters Module

```typescript
import * as yaml from 'js-yaml';

export function formatOutput(data: any, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    
    case 'yaml':
      return yaml.dump(data, { indent: 2, lineWidth: 120 });
    
    case 'table':
      return formatTable(data);
    
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function formatTable(data: any): string {
  // Handle events list
  if (data.events && Array.isArray(data.events)) {
    const headers = ['ID', 'TYPE', 'SEVERITY', 'TITLE', 'CREATED'];
    const rows = data.events.map((event: any) => [
      truncate(event.id, 28),
      event.event_type,
      event.severity,
      truncate(event.title, 40),
      formatDate(event.created_at),
    ]);
    
    return renderTable(headers, rows);
  }
  
  // Handle single event or status
  if (typeof data === 'object') {
    return renderKeyValueTable(data);
  }
  
  // Fallback to JSON
  return JSON.stringify(data, null, 2);
}

function renderTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return 'No results found';
  }
  
  // Calculate column widths
  const columnWidths = headers.map((h, i) => 
    Math.max(h.length, ...rows.map(r => r[i]?.length || 0))
  );
  
  // Format header row
  const headerRow = headers
    .map((h, i) => h.padEnd(columnWidths[i]))
    .join('  ');
  
  // Format separator
  const separator = columnWidths
    .map(w => '-'.repeat(w))
    .join('--');
  
  // Format data rows
  const dataRows = rows
    .map(row => row.map((cell, i) => cell.padEnd(columnWidths[i])).join('  '))
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
```

## Estimated Time

< 25 minutes

## Dependencies

- Story 001 (js-yaml must be installed)

