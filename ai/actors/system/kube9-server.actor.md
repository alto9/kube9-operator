---
actor_id: kube9-server
type: system
---

# kube9 Server

## Overview

The kube9 Server is the backend service that powers Pro tier features. It receives status updates and metrics from operators deployed in customer clusters.

## Responsibilities

- Validate API keys for Pro tier customers
- Receive and store cluster metrics from operators
- Serve rich web UIs to VS Code extension
- Process AI analysis requests
- Provide historical metrics and trends
- Generate recommendations and insights

## Characteristics

- **Platform**: Node.js web server (hosted by Alto9)
- **Deployment**: Centralized SaaS service at api.kube9.dev
- **Security**: HTTPS only, API key authentication
- **Storage**: Database for metrics, user data, and API keys

## Interaction with Operator

### Operator Registration

1. Operator starts up with configured API key
2. Operator calls kube9-server registration endpoint
3. Server validates API key and creates/updates cluster registration
4. Server returns configuration and metrics collection settings

### Metrics Push

1. Operator collects sanitized cluster metrics periodically
2. Operator pushes metrics to server via HTTPS POST
3. Server validates API key and stores metrics
4. Server responds with acknowledgment and any updated configuration

### Status Validation

When extension queries operator status:
1. Operator may optionally call server to validate API key freshness
2. Server confirms key is valid and returns tier status
3. Operator caches response and returns to extension

## Technical Requirements

- Must handle operators from multiple customer clusters
- Must validate API keys securely
- Must not expose sensitive data between different customers
- Must rate limit operator push requests
- Must provide API for extension to query cluster status (authenticated)

