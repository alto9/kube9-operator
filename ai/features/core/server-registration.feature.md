---
feature_id: server-registration
spec_id: [server-api-spec]
context_id: [kubernetes-operator-development]
---

# Server Registration Feature

## Overview

When the operator is installed with an API key (pro tier), it must register with kube9-server to validate the key and establish the cluster's identity.

## Behavior

```gherkin
Feature: Server Registration

Background:
  Given the kube9 operator is installed with an API key
  And the operator is running in "enabled" (pro tier) mode
  And the operator can make outbound HTTPS requests

Scenario: Successful registration with valid API key
  Given the operator has API key "kdy_prod_abc123"
  And the operator starts up
  When the operator attempts to register with kube9-server
  Then it should POST to https://api.kube9.dev/v1/operator/register
  And it should include the API key in the Authorization header
  And it should include operator version in the request
  And it should include cluster identifier (derived from cluster-info)
  When kube9-server validates the API key
  Then the server should respond with 200 OK
  And the server should return a registration confirmation
  And the operator should store the registration status locally
  And the operator should update its status ConfigMap to "enabled"

Scenario: Registration fails with invalid API key
  Given the operator has an invalid API key "kdy_prod_invalid"
  And the operator starts up
  When the operator attempts to register with kube9-server
  Then kube9-server should respond with 401 Unauthorized
  And the operator should log the authentication failure
  And the operator should fall back to "operated" (free tier) mode
  And the operator should update status ConfigMap with error details
  And the operator should NOT retry registration immediately

Scenario: Registration fails due to network issues
  Given the operator has a valid API key
  And the operator starts up
  But kube9-server is unreachable due to network issues
  When the operator attempts to register
  Then the registration should timeout after 30 seconds
  And the operator should log the connection failure
  And the operator should schedule a retry in 5 minutes
  And the operator should continue running in degraded "enabled" mode
  And the status ConfigMap should indicate registration is pending

Scenario: Periodic re-registration to keep session alive
  Given the operator has successfully registered
  And the operator has been running for 23 hours
  When the periodic re-registration timer expires
  Then the operator should call kube9-server to revalidate registration
  And kube9-server should confirm the API key is still valid
  And the operator should update its local registration status
  And the status ConfigMap should reflect successful re-registration

Scenario: API key is revoked after registration
  Given the operator has successfully registered
  And the cluster administrator revokes the API key in portal.kube9.dev
  When the operator attempts periodic re-registration
  Then kube9-server should respond with 401 Unauthorized
  And the operator should transition to "operated" (free tier) mode
  And the operator should update status ConfigMap indicating key revoked
  And the operator should log a clear error message

Scenario: Operator includes cluster metadata in registration
  Given the operator is registering with kube9-server
  When it prepares the registration request
  Then it should include:
    - Cluster identifier (hash of cluster CA or server URL)
    - Operator version
    - Kubernetes version
    - Approximate node count (for capacity planning)
  And it should NOT include:
    - Cluster credentials or kubeconfig
    - Sensitive cluster data
    - Pod names or application details

Scenario: Registration request timeout handling
  Given the operator is attempting to register
  When the HTTPS request to kube9-server takes longer than 30 seconds
  Then the operator should cancel the request
  And the operator should log a timeout error
  And the operator should schedule a retry in 5 minutes
  And the operator should continue running in degraded state

Scenario: Operator respects rate limiting from server
  Given the operator is attempting registration
  When kube9-server responds with 429 Too Many Requests
  Then the operator should parse the Retry-After header
  And the operator should wait the specified duration before retrying
  And the operator should log the rate limit event
  And the operator should continue running in current mode

Scenario: Server provides updated configuration during registration
  Given the operator successfully registers
  When kube9-server responds
  Then the server may include configuration updates such as:
    - Metrics collection interval (for future features)
    - Status update frequency
    - Feature flags
  And the operator should apply the configuration
  And the operator should persist configuration for future restarts
```

## Registration Request Format

```typescript
POST https://api.kube9.dev/v1/operator/register
Headers:
  Authorization: Bearer kdy_prod_abc123
  Content-Type: application/json

Body:
{
  "operatorVersion": "1.0.0",
  "clusterIdentifier": "sha256:abc123...",
  "kubernetesVersion": "1.28.0",
  "approximateNodeCount": 5
}
```

## Registration Response Format

```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "registered",
  "clusterId": "cls_abc123",
  "tier": "pro",
  "configuration": {
    "statusUpdateIntervalSeconds": 60,
    "reregistrationIntervalHours": 24
  }
}
```

## Integration Points

- **kube9-server**: Primary registration endpoint
- **Status ConfigMap**: Updated with registration status
- **Operator Deployment**: Includes API key from Secret
- **VS Code Extension**: Reads registration status from ConfigMap

## Error Handling

- Invalid API key → Fall back to free tier
- Network timeout → Retry with exponential backoff
- Rate limiting → Respect server rate limits
- Server error (5xx) → Retry with backoff

## Non-Goals

- Metrics push (future feature)
- Bidirectional communication (future feature)
- WebSocket connections (future feature)

