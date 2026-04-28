/**
 * Zod validation for CollectionPayload at persistence boundaries.
 */

import { z } from 'zod';

const sanitizationSchema = z.object({
  rulesApplied: z.array(z.string()),
  timestamp: z.string(),
});

const clusterMetadataDataSchema = z.object({
  timestamp: z.string(),
  collectionId: z.string(),
  clusterId: z.string(),
  kubernetesVersion: z.string(),
  nodeCount: z.number(),
  provider: z.enum(['aws', 'gcp', 'azure', 'on-premise', 'other', 'unknown']).optional(),
  region: z.string().optional(),
  zone: z.string().optional(),
});

const resourceInventoryDataSchema = z.object({
  timestamp: z.string(),
  collectionId: z.string(),
  clusterId: z.string(),
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
    timestamp: z.string(),
    collectionId: z.string(),
    clusterId: z.string(),
  })
  .passthrough();

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
]);

export type ParsedCollectionPayload = z.infer<typeof CollectionPayloadSchema>;
