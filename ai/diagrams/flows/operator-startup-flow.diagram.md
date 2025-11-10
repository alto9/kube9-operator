---
diagram_id: operator-startup-flow
category: flow
---

# Operator Startup Flow

This diagram shows the operator's initialization sequence when it starts up in a Kubernetes cluster.

```nomnoml
#direction: down
#.decision: fill=#ffffcc
#.process: fill=#ccffcc
#.external: fill=#ccccff

[<process>Operator Pod Starts]
[<process>Load Configuration]
[<decision>API Key Present?]
[<process>Set Mode: operated (free)]
[<process>Set Mode: enabled (pro)]
[<process>Initialize Status ConfigMap]
[<external>Register with kube9-server]
[<decision>Registration Successful?]
[<process>Update Status: enabled + registered]
[<process>Update Status: operated (fallback)]
[<process>Schedule Re-registration (24h)]
[<process>Start Status Update Loop]
[<process>Operator Ready]

[Operator Pod Starts] -> [Load Configuration]
[Load Configuration] reads -> [ConfigMap/Secret in kube9-system]
[Load Configuration] -> [API Key Present?]

[API Key Present?] no -> [Set Mode: operated (free)]
[API Key Present?] yes -> [Set Mode: enabled (pro)]

[Set Mode: operated (free)] -> [Initialize Status ConfigMap]
[Set Mode: enabled (pro)] -> [Register with kube9-server]

[Register with kube9-server] -> [Registration Successful?]
[Registration Successful?] yes -> [Update Status: enabled + registered]
[Registration Successful?] no -> [Update Status: operated (fallback)]

[Update Status: enabled + registered] -> [Schedule Re-registration (24h)]
[Update Status: operated (fallback)] -> [Start Status Update Loop]
[Schedule Re-registration (24h)] -> [Start Status Update Loop]
[Initialize Status ConfigMap] -> [Start Status Update Loop]

[Start Status Update Loop] -> [Operator Ready]
```

## Startup Phases

### 1. Configuration Loading
- Read environment variables
- Load API key from Secret (if present)
- Load configuration from ConfigMap
- Validate configuration values

### 2. Mode Determination
- **No API Key**: Set mode to "operated" (free tier)
- **API Key Present**: Set mode to "enabled" (pro tier)

### 3. Server Registration (Pro Tier Only)
- POST to kube9-server /v1/operator/register
- Include API key, operator version, cluster ID
- On success: Store registration confirmation
- On failure: Fall back to "operated" mode and log error

### 4. Status Initialization
- Create or update status ConfigMap
- Include: mode, tier, version, health status
- Make ConfigMap readable to extension

### 5. Background Tasks
- Start status update loop (every 60 seconds)
- Schedule re-registration (every 24 hours for pro tier)
- Start health check routine

## Error Handling

- **Invalid API Key**: Fall back to free tier, log error
- **Network Failure**: Continue in degraded mode, schedule retry
- **ConfigMap Write Failure**: Log error, retry after 30 seconds
- **Kubernetes API Errors**: Log error, backoff and retry

## Configuration Sources

```yaml
# From Helm values -> Secret
apiKey: kdy_prod_abc123

# From Helm values -> ConfigMap
statusUpdateIntervalSeconds: 60
reregistrationIntervalHours: 24
logLevel: info
```

