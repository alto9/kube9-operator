---
story_id: 016-implement-event-normalization
session_id: event-database-and-cli-query-interface
feature_id: [event-recording]
spec_id: []
status: completed
---

# Story: Implement Event Normalization and Metadata Sanitization

## Objective

Create functions that normalize Kubernetes Events and operator events into our standard event format with metadata sanitization.

## Acceptance Criteria

- [ ] `normalizeKubernetesEvent()` converts K8s Event to our Event format
- [ ] Maps K8s reason to event_type and severity
- [ ] Extracts object references (kind, namespace, name)
- [ ] `sanitizeMetadata()` redacts sensitive fields
- [ ] Redacts fields: password, token, secret, apiKey, credential
- [ ] Truncates metadata to 10KB max size
- [ ] Generates event ID with timestamp

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/events/event-normalizer.ts`

## Implementation Notes

### Event Normalizer

```typescript
import * as k8s from '@kubernetes/client-node';
import { Event, EventType, SeverityLevel } from '../types/event.js';
import { generateEventId } from '../database/event-id.js';

/**
 * Normalize a Kubernetes Event object to our Event format
 */
export function normalizeKubernetesEvent(k8sEvent: k8s.CoreV1Event): Event {
  const { eventType, severity } = mapKubernetesEventType(k8sEvent);
  
  return {
    id: generateEventId(),
    event_type: eventType,
    severity: severity,
    title: formatEventTitle(k8sEvent),
    description: k8sEvent.message || undefined,
    object_kind: k8sEvent.involvedObject?.kind,
    object_namespace: k8sEvent.involvedObject?.namespace,
    object_name: k8sEvent.involvedObject?.name,
    metadata: sanitizeMetadata({
      reason: k8sEvent.reason,
      count: k8sEvent.count,
      first_timestamp: k8sEvent.firstTimestamp,
      last_timestamp: k8sEvent.lastTimestamp,
    }),
    created_at: new Date().toISOString(),
  };
}

/**
 * Map Kubernetes Event reason to our event type and severity
 */
function mapKubernetesEventType(k8sEvent: k8s.CoreV1Event): {
  eventType: EventType;
  severity: SeverityLevel;
} {
  const reason = k8sEvent.reason || '';
  const k8sType = k8sEvent.type || 'Normal';
  
  // Critical failures
  if (['OOMKilled', 'NodeNotReady', 'FailedKillPod'].includes(reason)) {
    return { eventType: 'cluster', severity: 'critical' };
  }
  
  // Errors
  if ([
    'Failed',
    'CrashLoopBackOff',
    'ImagePullBackOff',
    'FailedScheduling',
    'FailedBinding',
    'FailedCreate',
    'FailedMount',
  ].includes(reason)) {
    return { eventType: 'cluster', severity: 'error' };
  }
  
  // Warnings
  if (['BackOff', 'Unhealthy', 'EvictedPod'].includes(reason) || k8sType === 'Warning') {
    return { eventType: 'cluster', severity: 'warning' };
  }
  
  // Default: info
  return { eventType: 'cluster', severity: 'info' };
}

/**
 * Format event title from Kubernetes Event
 */
function formatEventTitle(k8sEvent: k8s.CoreV1Event): string {
  const reason = k8sEvent.reason || 'Event';
  const kind = k8sEvent.involvedObject?.kind || 'Unknown';
  const name = k8sEvent.involvedObject?.name || '';
  
  return `${kind} ${reason}${name ? ': ' + name : ''}`;
}

/**
 * Sanitize metadata by redacting sensitive fields and truncating size
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const maxSize = 10 * 1024; // 10KB
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apikey',
    'api_key',
    'credential',
    'auth',
    'authorization',
  ];
  
  // Redact sensitive fields
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  // Check size
  const json = JSON.stringify(sanitized);
  
  if (json.length > maxSize) {
    // Truncate and add indicator
    const truncated = json.substring(0, maxSize - 50);
    return {
      ...JSON.parse(truncated + '{}'),
      _truncated: true,
      _original_size: json.length,
    };
  }
  
  return sanitized;
}

/**
 * Create operator lifecycle event
 */
export function createOperatorEvent(
  title: string,
  description: string,
  severity: SeverityLevel,
  metadata?: Record<string, any>
): Event {
  return {
    id: generateEventId(),
    event_type: 'operator',
    severity,
    title,
    description,
    metadata: metadata ? sanitizeMetadata(metadata) : undefined,
    created_at: new Date().toISOString(),
  };
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 006 (Event ID generation)
- Story 007 (Event types)

