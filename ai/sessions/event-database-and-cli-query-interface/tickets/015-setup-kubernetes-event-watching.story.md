---
story_id: 015-setup-kubernetes-event-watching
session_id: event-database-and-cli-query-interface
feature_id: [event-recording]
spec_id: []
status: pending
---

# Story: Setup Kubernetes Event Watching

## Objective

Create a Kubernetes Event watcher that watches for Event objects in the cluster and detects significant events.

## Acceptance Criteria

- [ ] `KubernetesEventWatcher` class created
- [ ] Establishes watch on `core/v1/Event` API
- [ ] Handles watch events: ADDED, MODIFIED
- [ ] Filters significant events (errors, warnings, failures)
- [ ] Automatically reconnects on watch failure
- [ ] Can be started and stopped
- [ ] Logs watch connection status

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/events/kubernetes-event-watcher.ts`

## Implementation Notes

### KubernetesEventWatcher Class

```typescript
import * as k8s from '@kubernetes/client-node';
import { EventRecorder } from './event-recorder.js';
import { normalizeKubernetesEvent } from './event-normalizer.js';

export class KubernetesEventWatcher {
  private kc: k8s.KubeConfig;
  private watch: k8s.Watch;
  private recorder: EventRecorder;
  private isWatching = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    this.kc = new k8s.KubeConfig();
    
    try {
      this.kc.loadFromCluster();
    } catch {
      this.kc.loadFromDefault();
    }
    
    this.watch = new k8s.Watch(this.kc);
    this.recorder = EventRecorder.getInstance();
  }

  /**
   * Start watching Kubernetes Events
   */
  public async start(): Promise<void> {
    if (this.isWatching) {
      console.warn('Kubernetes Event watcher already running');
      return;
    }
    
    this.isWatching = true;
    await this.startWatch();
  }

  /**
   * Stop watching Kubernetes Events
   */
  public stop(): void {
    this.isWatching = false;
    console.log('Kubernetes Event watcher stopped');
  }

  private async startWatch(): Promise<void> {
    try {
      console.log('Starting Kubernetes Event watch...');
      
      await this.watch.watch(
        '/api/v1/events',
        {},
        (type: string, apiObj: any) => {
          this.handleWatchEvent(type, apiObj);
        },
        (err: any) => {
          if (err) {
            console.error('Kubernetes Event watch error:', err.message);
            this.handleWatchError(err);
          }
        }
      );
      
      this.reconnectAttempts = 0;
      console.log('Kubernetes Event watch established');
      
    } catch (error: any) {
      console.error('Failed to start Kubernetes Event watch:', error.message);
      this.handleWatchError(error);
    }
  }

  private handleWatchEvent(type: string, apiObj: any): void {
    if (!this.isWatching) {
      return;
    }
    
    // Only process ADDED and MODIFIED events
    if (type !== 'ADDED' && type !== 'MODIFIED') {
      return;
    }
    
    // Filter significant events
    if (!this.isSignificantEvent(apiObj)) {
      return;
    }
    
    try {
      // Normalize Kubernetes Event to our event format
      const event = normalizeKubernetesEvent(apiObj);
      
      // Record event (non-blocking)
      this.recorder.recordEvent(event);
      
    } catch (error: any) {
      console.error('Failed to process Kubernetes Event:', error.message);
    }
  }

  private isSignificantEvent(event: k8s.CoreV1Event): boolean {
    // Only record events with these types/reasons
    const significantReasons = [
      'Failed',
      'BackOff',
      'CrashLoopBackOff',
      'ImagePullBackOff',
      'FailedScheduling',
      'FailedBinding',
      'FailedCreate',
      'FailedMount',
      'OOMKilled',
      'NodeNotReady',
      'SuccessfulRescale',
      'Unhealthy',
      'FailedKillPod',
    ];
    
    return significantReasons.includes(event.reason || '');
  }

  private handleWatchError(error: any): void {
    if (!this.isWatching) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached, stopping watch');
      this.isWatching = false;
      return;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
    const delayMs = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 60000);
    this.reconnectAttempts++;
    
    console.log(`Reconnecting Kubernetes Event watch in ${delayMs}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.isWatching) {
        this.startWatch();
      }
    }, delayMs);
  }
}
```

## Estimated Time

< 30 minutes

## Dependencies

- Story 013 (EventRecorder)
- Story 016 (Event normalizer, created next)

