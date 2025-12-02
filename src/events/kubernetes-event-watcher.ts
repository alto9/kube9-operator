/**
 * Kubernetes Event Watcher - Watches K8s events
 */

import * as k8s from '@kubernetes/client-node';
import { EventRecorder } from './event-recorder.js';
import { normalizeKubernetesEvent } from './event-normalizer.js';
import { logger } from '../logging/logger.js';

export class KubernetesEventWatcher {
  private kc: k8s.KubeConfig;
  private watch: k8s.Watch;
  private recorder: EventRecorder;
  private isWatching = false;
  private abortController: AbortController | null = null;

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
      logger.warn('Kubernetes event watcher already running');
      return;
    }
    
    this.isWatching = true;
    this.abortController = new AbortController();
    
    try {
      await this.watch.watch(
        '/api/v1/events',
        {},
        (type: string, event: k8s.CoreV1Event) => {
          this.handleEvent(type, event);
        },
        (err: any) => {
          if (err) {
            logger.error('K8s event watch error', { error: err.message });
            if (this.isWatching) {
              // Reconnect after delay
              setTimeout(() => {
                if (this.isWatching) {
                  this.start();
                }
              }, 5000);
            }
          }
        }
      );
      
      logger.info('Kubernetes event watcher started');
    } catch (error: any) {
      logger.error('Failed to start K8s event watcher', { error: error.message });
      this.isWatching = false;
    }
  }

  /**
   * Stop watching Kubernetes Events
   */
  public stop(): void {
    this.isWatching = false;
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    logger.info('Kubernetes event watcher stopped');
  }

  /**
   * Handle a Kubernetes Event
   */
  private handleEvent(type: string, k8sEvent: k8s.CoreV1Event): void {
    if (type !== 'ADDED' && type !== 'MODIFIED') {
      return;
    }
    
    // Filter significant events
    if (this.isSignificantEvent(k8sEvent)) {
      try {
        const event = normalizeKubernetesEvent(k8sEvent);
        this.recorder.recordEvent(event);
      } catch (error: any) {
        logger.error('Failed to normalize K8s event', { error: error.message });
      }
    }
  }

  /**
   * Determine if a K8s Event is significant enough to record
   */
  private isSignificantEvent(event: k8s.CoreV1Event): boolean {
    const reason = event.reason || '';
    const type = event.type || 'Normal';
    
    // Record all warnings and errors
    if (type === 'Warning' || type === 'Error') {
      return true;
    }
    
    // Record specific significant reasons
    const significantReasons = [
      'OOMKilled',
      'Failed',
      'CrashLoopBackOff',
      'ImagePullBackOff',
      'FailedScheduling',
      'NodeNotReady',
      'Unhealthy',
    ];
    
    return significantReasons.includes(reason);
  }
}

