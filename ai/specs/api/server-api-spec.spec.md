---
spec_id: server-api-spec
feature_id: [server-registration]
context_id: [kubernetes-operator-development]
---

# kube9-server API Specification

## Overview

This specification defines the API endpoints that the operator calls on kube9-server for registration and API key validation.

## Base URL

```
Production: https://api.kube9.dev
Development: https://api.dev.kube9.dev
```

## Authentication

All requests require API key authentication via Bearer token:

```
Authorization: Bearer kdy_prod_abc123def456
```

## API Endpoints

### POST /v1/operator/register

Register an operator instance with the server and validate the API key.

#### Request

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {apiKey}
User-Agent: kube9-operator/1.0.0
```

**Body:**
```typescript
interface RegistrationRequest {
  // Operator version (semver)
  operatorVersion: string;
  
  // Unique cluster identifier (SHA256 hash of cluster CA cert or server URL)
  clusterIdentifier: string;
  
  // Kubernetes version running in cluster
  kubernetesVersion: string;
  
  // Approximate node count (for capacity planning, not exact)
  approximateNodeCount: number;
}
```

**Example:**
```json
{
  "operatorVersion": "1.0.0",
  "clusterIdentifier": "sha256:a1b2c3d4e5f6...",
  "kubernetesVersion": "1.28.0",
  "approximateNodeCount": 5
}
```

#### Response - Success (200 OK)

```typescript
interface RegistrationResponse {
  // Registration status
  status: "registered" | "reregistered";
  
  // Server-assigned cluster ID
  clusterId: string;
  
  // Confirmed tier
  tier: "pro";
  
  // Configuration for operator
  configuration: {
    // How often to update status (seconds)
    statusUpdateIntervalSeconds: number;
    
    // How often to re-register (hours)
    reregistrationIntervalHours: number;
    
    // Optional: Future metrics collection settings
    metricsEnabled?: boolean;
    metricsIntervalSeconds?: number;
  };
  
  // Optional: Server message to operator
  message?: string;
}
```

**Example:**
```json
{
  "status": "registered",
  "clusterId": "cls_abc123def456",
  "tier": "pro",
  "configuration": {
    "statusUpdateIntervalSeconds": 60,
    "reregistrationIntervalHours": 24
  },
  "message": "Welcome to kube9 Pro!"
}
```

#### Response - Unauthorized (401)

API key is invalid, expired, or revoked.

```typescript
interface ErrorResponse {
  error: string;
  code: string;
  message: string;
}
```

**Example:**
```json
{
  "error": "unauthorized",
  "code": "INVALID_API_KEY",
  "message": "The provided API key is invalid or has been revoked"
}
```

**Operator Behavior:**
- Log error with details
- Fall back to "operated" (free tier) mode
- Do not retry immediately (wait 24 hours or restart)

#### Response - Rate Limited (429)

Too many registration requests from this operator.

**Headers:**
```
Retry-After: 3600
```

**Body:**
```json
{
  "error": "rate_limit_exceeded",
  "code": "TOO_MANY_REQUESTS",
  "message": "Too many registration attempts. Please retry after 3600 seconds."
}
```

**Operator Behavior:**
- Parse `Retry-After` header
- Wait specified duration before retrying
- Log rate limit event

#### Response - Server Error (500, 502, 503, 504)

Server-side error or maintenance.

```json
{
  "error": "internal_server_error",
  "code": "SERVER_ERROR",
  "message": "An unexpected error occurred. Please try again later."
}
```

**Operator Behavior:**
- Log error
- Retry with exponential backoff (5m, 10m, 20m, etc.)
- Continue in degraded mode

#### Response - Bad Request (400)

Invalid request format or missing required fields.

```json
{
  "error": "bad_request",
  "code": "INVALID_REQUEST",
  "message": "Missing required field: operatorVersion",
  "details": {
    "field": "operatorVersion",
    "issue": "required"
  }
}
```

**Operator Behavior:**
- Log error with details
- Check configuration and fix
- Do not retry without fixing issue

### GET /v1/operator/health

Health check endpoint (optional, for future use).

#### Request

**Headers:**
```
Authorization: Bearer {apiKey}
```

#### Response (200 OK)

```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

## Error Codes

| HTTP Status | Error Code | Description | Operator Action |
|-------------|-----------|-------------|----------------|
| 400 | `INVALID_REQUEST` | Malformed request | Fix and retry |
| 401 | `INVALID_API_KEY` | API key invalid/revoked | Fall back to free tier |
| 401 | `API_KEY_EXPIRED` | API key expired | Fall back to free tier |
| 403 | `FORBIDDEN` | Operation not allowed | Log and investigate |
| 404 | `NOT_FOUND` | Endpoint not found | Check operator version |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded | Respect Retry-After |
| 500 | `SERVER_ERROR` | Internal server error | Retry with backoff |
| 502 | `BAD_GATEWAY` | Gateway error | Retry with backoff |
| 503 | `SERVICE_UNAVAILABLE` | Service down | Retry with backoff |
| 504 | `GATEWAY_TIMEOUT` | Request timeout | Retry with backoff |

## Rate Limiting

### Limits

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| `/v1/operator/register` | 10 requests | per hour per cluster |
| `/v1/operator/health` | 100 requests | per hour per cluster |

### Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699999999
```

## Security

### TLS/HTTPS

- All communication must use HTTPS
- TLS 1.2 or higher required
- Certificate validation enforced

### API Key Format

API keys follow this format:

```
kdy_{environment}_{random}

Examples:
- kdy_prod_a1b2c3d4e5f6g7h8
- kdy_dev_x9y8z7w6v5u4t3s2
```

### Cluster Identifier

The operator generates a unique cluster identifier:

```typescript
function generateClusterIdentifier(clusterInfo: ClusterInfo): string {
  // Use cluster CA certificate if available
  if (clusterInfo.certificateAuthority) {
    return `sha256:${sha256(clusterInfo.certificateAuthority)}`;
  }
  
  // Fallback to server URL
  return `sha256:${sha256(clusterInfo.server)}`;
}
```

**Important:** The identifier must be:
- Deterministic (same cluster → same identifier)
- Non-reversible (cannot extract CA cert from identifier)
- Unique per cluster

## Request/Response Examples

### Successful First Registration

**Request:**
```http
POST /v1/operator/register HTTP/1.1
Host: api.kube9.dev
Content-Type: application/json
Authorization: Bearer kdy_prod_abc123def456
User-Agent: kube9-operator/1.0.0

{
  "operatorVersion": "1.0.0",
  "clusterIdentifier": "sha256:a1b2c3...",
  "kubernetesVersion": "1.28.0",
  "approximateNodeCount": 5
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1699999999

{
  "status": "registered",
  "clusterId": "cls_new123",
  "tier": "pro",
  "configuration": {
    "statusUpdateIntervalSeconds": 60,
    "reregistrationIntervalHours": 24
  }
}
```

### Successful Re-registration

**Request:** (Same as first registration)

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "reregistered",
  "clusterId": "cls_new123",
  "tier": "pro",
  "configuration": {
    "statusUpdateIntervalSeconds": 60,
    "reregistrationIntervalHours": 24
  },
  "message": "Welcome back!"
}
```

### Invalid API Key

**Request:** (Same as first registration, but with invalid key)

**Response:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "unauthorized",
  "code": "INVALID_API_KEY",
  "message": "The provided API key is invalid or has been revoked"
}
```

### Rate Limited

**Request:** (After 10 registrations in 1 hour)

**Response:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 3600
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699999999

{
  "error": "rate_limit_exceeded",
  "code": "TOO_MANY_REQUESTS",
  "message": "Too many registration attempts. Please retry after 3600 seconds."
}
```

## Operator Implementation

### Registration Client

```typescript
class RegistrationClient {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly httpTimeout = 30000; // 30 seconds
  
  async register(request: RegistrationRequest): Promise<RegistrationResponse> {
    try {
      const response = await fetch(`${this.serverUrl}/v1/operator/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': `kube9-operator/${request.operatorVersion}`
        },
        body: JSON.stringify(request),
        timeout: this.httpTimeout
      });
      
      if (response.status === 200) {
        return await response.json();
      }
      
      if (response.status === 401) {
        throw new UnauthorizedError('API key is invalid');
      }
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(`Rate limited, retry after ${retryAfter}s`);
      }
      
      throw new ServerError(`Server returned ${response.status}`);
      
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        throw new TimeoutError('Registration request timed out');
      }
      throw error;
    }
  }
}
```

## Testing

### Unit Tests
- Request serialization
- Response parsing
- Error handling
- Retry logic

### Integration Tests
- Successful registration
- Invalid API key handling
- Rate limiting behavior
- Network failure handling

### End-to-End Tests
- Fresh cluster registration
- Re-registration after 24 hours
- API key revocation scenario
- Server downtime scenario

## Monitoring

### Server-Side Metrics

```
kube9_server_registration_requests_total{status="success"} 1500
kube9_server_registration_requests_total{status="invalid_key"} 25
kube9_server_registration_duration_seconds{quantile="0.95"} 0.2
```

### Operator-Side Metrics

```
kube9_operator_registration_attempts_total{result="success"} 1
kube9_operator_registration_attempts_total{result="failure"} 0
kube9_operator_registration_duration_seconds 0.15
```

## Versioning

API versioning in URL path: `/v1/`, `/v2/`, etc.

**Version 1.0 (MVP)**:
- Registration endpoint
- Basic error handling

**Future Versions**:
- Metrics push endpoint
- Real-time updates
- Webhook support

