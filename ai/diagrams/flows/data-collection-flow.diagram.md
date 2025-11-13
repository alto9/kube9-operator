---
diagram_id: data-collection-flow
name: Data Collection Flow
description: Shows how the operator collects data from the Kubernetes cluster, processes it, and either stores it locally (free tier) or transmits it to kube9-server (pro tier).
diagram_type: flow
feature_id: [cluster-metadata-collection, resource-inventory-collection]
spec_id: [cluster-metadata-collection-spec, resource-inventory-collection-spec]
---

```nomnoml
#direction: right
#padding: 10

[Collection Scheduler] -> [Cluster Metadata Collector|24h interval]
[Collection Scheduler] -> [Resource Inventory Collector|6h interval]

[Cluster Metadata Collector] -> [Kubernetes API|Version API]
[Cluster Metadata Collector] -> [Kubernetes API|Nodes API]

[Resource Inventory Collector] -> [Kubernetes API|Namespaces API]
[Resource Inventory Collector] -> [Kubernetes API|Pods API]
[Resource Inventory Collector] -> [Kubernetes API|Deployments API]
[Resource Inventory Collector] -> [Kubernetes API|Services API]

[Cluster Metadata Collector] -> [Schema Validator]
[Resource Inventory Collector] -> [Schema Validator]

[Schema Validator] -> {Tier Check}

{Tier Check} ->|Free Tier| [Local Storage|In-Memory]
{Tier Check} ->|Pro Tier| [Sanitizer]

[Sanitizer] -> [Schema Validator]
[Schema Validator] -> [kube9-server|HTTPS POST]

[Local Storage] --> [Collection Metrics]
[kube9-server] --> [Collection Metrics]
```

