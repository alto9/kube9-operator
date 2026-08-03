/**
 * Zod validation for CollectionPayload at persistence boundaries.
 */

import { z } from 'zod';

const MAX_DATA_BYTES = 64 * 1024;

const sanitizationSchema = z.object({
  rulesApplied: z.array(z.string()),
  timestamp: z.string(),
});

const identityFieldsSchema = {
  timestamp: z.string(),
  collectionId: z.string(),
  clusterId: z.string(),
};

const ratioField = z.number().min(0).max(1);

const utilizationCpuMemorySchema = z
  .object({
    clusterAvgRatio: ratioField.optional(),
    nodeHighWatermarkRatio: ratioField.optional(),
  })
  .strict()
  .optional();

const boundedRatiosSchema = z
  .record(z.string().max(64), ratioField)
  .refine((obj) => Object.keys(obj).length <= 16, {
    message: 'ratios may contain at most 16 keys',
  });

function rejectOversizedData<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_DATA_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `serialized data exceeds ${MAX_DATA_BYTES} bytes`,
      });
    }
  });
}

const clusterMetadataDataSchema = z.object({
  ...identityFieldsSchema,
  kubernetesVersion: z.string(),
  nodeCount: z.number(),
  provider: z.enum(['aws', 'gcp', 'azure', 'on-premise', 'other', 'unknown']).optional(),
  region: z.string().optional(),
  zone: z.string().optional(),
});

const resourceInventoryDataSchema = z.object({
  ...identityFieldsSchema,
  namespaces: z.object({
    count: z.number(),
    list: z.array(z.string()),
  }),
  resources: z.object({
    pods: z.object({
      total: z.number(),
      byNamespace: z.record(z.string(), z.number()),
    }),
    deployments: z.object({ total: z.number() }),
    statefulSets: z.object({ total: z.number() }),
    replicaSets: z.object({ total: z.number() }),
    services: z.object({
      total: z.number(),
      byType: z
        .object({
          ClusterIP: z.number().optional(),
          NodePort: z.number().optional(),
          LoadBalancer: z.number().optional(),
          ExternalName: z.number().optional(),
        })
        .partial()
        .optional(),
    }),
  }),
});

/** Nested pattern shapes vary; core identifiers and timestamp are required. */
const resourceConfigurationDataSchema = z
  .object({
    ...identityFieldsSchema,
  })
  .passthrough();

const performanceMetricsDataSchema = rejectOversizedData(
  z
    .object({
      ...identityFieldsSchema,
      source: z
        .object({
          available: z.boolean(),
          reason: z.string().max(200).optional(),
        })
        .strict(),
      utilization: z
        .object({
          cpu: utilizationCpuMemorySchema,
          memory: utilizationCpuMemorySchema,
        })
        .strict()
        .optional(),
      ratios: boundedRatiosSchema.optional(),
    })
    .strict()
);

const nsaCisRollupsSchema = z
  .object({
    allowPrivilegeEscalationTrueContainers: z.number().int().min(0),
    runAsNonRootFalseContainers: z.number().int().min(0),
    readOnlyRootFilesystemFalseContainers: z.number().int().min(0),
    capabilitiesNotDroppedAllContainers: z.number().int().min(0),
    automountServiceAccountTokenTruePods: z.number().int().min(0),
    hostNamespacesPods: z.number().int().min(0),
  })
  .strict();

const securityPostureDataSchema = rejectOversizedData(
  z
    .object({
      ...identityFieldsSchema,
      privilegedHost: z
        .object({
          privilegedContainers: z.number().int().min(0),
          hostPathVolumes: z.number().int().min(0),
          hostNetworkPods: z.number().int().min(0),
          hostPIDPods: z.number().int().min(0).optional(),
          hostIPCPods: z.number().int().min(0).optional(),
        })
        .strict(),
      networkPolicyCoverage: z
        .object({
          namespacesTotal: z.number().int().min(0),
          namespacesWithNetworkPolicy: z.number().int().min(0),
          coverageRatio: ratioField.optional(),
        })
        .strict(),
      nsaCisRollups: nsaCisRollupsSchema,
    })
    .strict()
);

export const CollectionPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    version: z.string(),
    type: z.literal('cluster-metadata'),
    data: clusterMetadataDataSchema,
    sanitization: sanitizationSchema,
  }),
  z.object({
    version: z.string(),
    type: z.literal('resource-inventory'),
    data: resourceInventoryDataSchema,
    sanitization: sanitizationSchema,
  }),
  z.object({
    version: z.string(),
    type: z.literal('resource-configuration-patterns'),
    data: resourceConfigurationDataSchema,
    sanitization: sanitizationSchema,
  }),
  z.object({
    version: z.string(),
    type: z.literal('performance-metrics'),
    data: performanceMetricsDataSchema,
    sanitization: sanitizationSchema,
  }),
  z.object({
    version: z.string(),
    type: z.literal('security-posture'),
    data: securityPostureDataSchema,
    sanitization: sanitizationSchema,
  }),
]);

export type ParsedCollectionPayload = z.infer<typeof CollectionPayloadSchema>;
