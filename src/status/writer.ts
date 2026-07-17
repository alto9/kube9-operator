import * as k8s from '@kubernetes/client-node';
import { kubernetesClient, KubernetesClient } from '../kubernetes/client.js';
import { calculateStatus } from './calculator.js';
import {
  buildAssessmentScheduleContextFromConfig,
  buildAssessmentStatusSummary,
  DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT,
  loadLatestPersistedAssessment,
} from './assessment-summary.js';
import {
  buildAiConformanceScheduleContextFromConfig,
  buildAiConformanceStatusSummary,
  DEFAULT_AI_CONFORMANCE_SCHEDULE_CONTEXT,
  DEFAULT_AI_CONFORMANCE_SUMMARY,
  loadLatestPersistedAiConformanceSummary,
} from './ai-conformance-summary.js';
import { getConfig } from '../config/loader.js';
import type { OperatorStatus } from './types.js';
import { getScheduledAssessmentLastRunSnapshot } from '../assessment/scheduled-tick.js';
import { AssessmentRepository } from '../database/assessment-repository.js';
import { AiConformanceRepository } from '../database/ai-conformance-repository.js';
import { logger } from '../logging/logger.js';
import { collectionStatsTracker } from '../collection/stats-tracker.js';
import { argocdStatusTracker } from '../argocd/state.js';
import { trivyStatusTracker } from '../trivy/state.js';
import { withPersistedArgoApplicationsSummary } from './argocd-for-status.js';
import {
  mergeResourceTreeProbeIntoStatus,
  runResourceTreeCapabilityProbe,
} from '../argocd/resource-tree-probe.js';

/**
 * ConfigMap name for operator status
 */
const STATUS_CONFIGMAP_NAME = 'kube9-operator-status';

/**
 * Namespace for operator status ConfigMap
 * Uses POD_NAMESPACE environment variable (set by Helm via downward API)
 * Falls back to 'kube9-system' for backwards compatibility
 */
const STATUS_NAMESPACE = process.env.POD_NAMESPACE || 'kube9-system';

/**
 * Creates or updates a ConfigMap in the specified namespace
 *
 * @param namespace - Kubernetes namespace
 * @param name - ConfigMap name
 * @param data - Data to store in ConfigMap
 * @param labels - Labels to apply to ConfigMap
 * @returns Promise that resolves when ConfigMap is created/updated
 * @throws Error if ConfigMap operations fail
 */
async function createOrUpdateConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>,
  labels: Record<string, string>,
  coreApi: k8s.CoreV1Api
): Promise<void> {
  const configMap: k8s.V1ConfigMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name,
      namespace,
      labels,
    },
    data,
  };

  try {
    await coreApi.readNamespacedConfigMap({ name, namespace });
    await coreApi.replaceNamespacedConfigMap({ name, namespace, body: configMap });
  } catch (error: unknown) {
    const httpError = error as { code?: number; statusCode?: number };

    if (httpError.code === 404 || httpError.statusCode === 404) {
      await coreApi.createNamespacedConfigMap({ namespace, body: configMap });
    } else {
      throw error;
    }
  }
}

/**
 * StatusWriter manages periodic updates of operator status to a ConfigMap
 */
export class StatusWriter {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly kubernetesClient: KubernetesClient;
  private readonly intervalSeconds: number;
  private lastWriteError: string | null = null;

  /**
   * Creates a new StatusWriter instance
   *
   * @param client - Kubernetes client instance (defaults to singleton)
   * @param intervalSeconds - Update interval in seconds (defaults to 60)
   */
  constructor(client?: KubernetesClient, intervalSeconds: number = 60) {
    this.kubernetesClient = client ?? kubernetesClient;
    this.intervalSeconds = intervalSeconds;
  }

  /**
   * Starts periodic status updates
   */
  start(): void {
    if (this.intervalId !== null) {
      logger.warn('StatusWriter is already running');
      return;
    }

    logger.info('Starting status writer', { intervalSeconds: this.intervalSeconds });

    this.updateStatus().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Initial status update failed', { error: errorMessage });
    });

    this.intervalId = setInterval(() => {
      this.updateStatus().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Periodic status update failed', { error: errorMessage });
      });
    }, this.intervalSeconds * 1000);
  }

  /**
   * Stops periodic status updates
   */
  stop(): void {
    if (this.intervalId === null) {
      return;
    }

    logger.info('Stopping status writer');
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /**
   * Writes a final status update to the ConfigMap
   * Used during graceful shutdown to indicate the operator is shutting down
   *
   * @param status - Final status to write
   */
  async writeFinalStatus(status: OperatorStatus): Promise<void> {
    try {
      const statusJson = JSON.stringify(status, null, 2);

      await createOrUpdateConfigMap(
        STATUS_NAMESPACE,
        STATUS_CONFIGMAP_NAME,
        { status: statusJson },
        {
          'app.kubernetes.io/name': 'kube9-operator',
          'app.kubernetes.io/component': 'status',
        },
        this.kubernetesClient.coreApi
      );

      logger.info('Final status update written: shutting down');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to write final status ConfigMap', { error: errorMessage });
    }
  }

  /**
   * Updates the status ConfigMap with current operator status
   * Handles errors gracefully without crashing the operator
   */
  private async updateStatus(): Promise<void> {
    try {
      const canWriteConfigMap = true;

      const collectionStats = collectionStatsTracker.getStats();
      const detectionStatus = argocdStatusTracker.getStatus();
      const probeResult = await runResourceTreeCapabilityProbe(detectionStatus);
      const argocdWithProbe = mergeResourceTreeProbeIntoStatus(detectionStatus, probeResult);
      const argocdStatus = withPersistedArgoApplicationsSummary(argocdWithProbe);
      const trivyStatus = trivyStatusTracker.getStatus();
      let assessmentSchedule = DEFAULT_ASSESSMENT_SCHEDULE_CONTEXT;
      try {
        assessmentSchedule = buildAssessmentScheduleContextFromConfig(getConfig());
      } catch {
        // Config not initialized (unlikely in production); omit schedule fields
      }
      const assessmentRepo = new AssessmentRepository();
      const { record: latestDbRun, checks: dbChecks } = loadLatestPersistedAssessment(assessmentRepo);
      const assessmentSummary = buildAssessmentStatusSummary(
        getScheduledAssessmentLastRunSnapshot(),
        assessmentSchedule,
        latestDbRun,
        dbChecks
      );

      let aiConformanceSchedule = DEFAULT_AI_CONFORMANCE_SCHEDULE_CONTEXT;
      try {
        aiConformanceSchedule = buildAiConformanceScheduleContextFromConfig(getConfig());
      } catch {
        // Config not initialized; omit schedule fields
      }
      let aiConformanceSummary = DEFAULT_AI_CONFORMANCE_SUMMARY;
      try {
        const conformanceRepo = new AiConformanceRepository();
        aiConformanceSummary = buildAiConformanceStatusSummary(
          loadLatestPersistedAiConformanceSummary(conformanceRepo),
          aiConformanceSchedule
        );
      } catch (conformanceErr) {
        logger.warn('Failed to load AI conformance summary for status', {
          error:
            conformanceErr instanceof Error ? conformanceErr.message : String(conformanceErr),
        });
        aiConformanceSummary = {
          ...DEFAULT_AI_CONFORMANCE_SUMMARY,
          schedulingEnabled: aiConformanceSchedule.schedulingEnabled,
          scheduleIntervalSeconds: aiConformanceSchedule.scheduleIntervalSeconds,
          checklistSource: aiConformanceSchedule.checklistSource,
        };
      }

      const status = calculateStatus(
        this.lastWriteError,
        canWriteConfigMap,
        collectionStats,
        argocdStatus,
        trivyStatus,
        assessmentSummary,
        aiConformanceSummary
      );

      const statusJson = JSON.stringify(status, null, 2);

      await createOrUpdateConfigMap(
        STATUS_NAMESPACE,
        STATUS_CONFIGMAP_NAME,
        { status: statusJson },
        {
          'app.kubernetes.io/name': 'kube9-operator',
          'app.kubernetes.io/component': 'status',
        },
        this.kubernetesClient.coreApi
      );

      if (this.lastWriteError !== null) {
        this.lastWriteError = null;
        logger.info('Status ConfigMap write recovered from previous error');
      }

      logger.info('Status updated', {
        mode: status.mode,
        health: status.health,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastWriteError = errorMessage;

      logger.error('Failed to update status ConfigMap', { error: errorMessage });

      if (error instanceof Error && 'response' in error) {
        const k8sError = error as { response?: { statusCode?: number; body?: unknown } };
        if (k8sError.response?.statusCode === 403) {
          logger.error('ConfigMap write forbidden: check RBAC permissions for ConfigMap create/update');
        }
      }
    }
  }
}
