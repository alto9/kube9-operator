---
story_id: 019-add-database-health-check
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: completed
---

# Story: Add Database Health Check to /healthz Endpoint

## Objective

Add database connectivity and health verification to the operator's `/healthz` endpoint.

## Acceptance Criteria

- [ ] Health check verifies database connection
- [ ] Health check performs test query (SELECT 1)
- [ ] Returns "healthy" if database is accessible
- [ ] Returns "degraded" if database has issues
- [ ] Includes database status in health response
- [ ] Doesn't crash if database is unavailable

## Files to Modify

- `/home/danderson/code/alto9/opensource/kube9-operator/src/health/health-check.ts` (or equivalent)

## Implementation Notes

### Add Database Health Check

```typescript
import { DatabaseManager } from '../database/manager.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database?: {
      status: 'ok' | 'error';
      message?: string;
    };
    kubernetes?: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
}

export function checkHealth(): HealthStatus {
  const checks: HealthStatus['checks'] = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  // Check database
  try {
    const dbManager = DatabaseManager.getInstance();
    const db = dbManager.getDatabase();
    
    // Perform test query
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    
    if (result.test === 1) {
      checks.database = { status: 'ok' };
    } else {
      checks.database = { 
        status: 'error', 
        message: 'Test query failed' 
      };
      overallStatus = 'degraded';
    }
  } catch (error: any) {
    checks.database = {
      status: 'error',
      message: error.message,
    };
    overallStatus = 'degraded';
  }
  
  // Check Kubernetes (existing code)
  // ... existing Kubernetes health check ...
  
  return {
    status: overallStatus,
    checks,
  };
}
```

### Update Health Endpoint

```typescript
// In Express app
app.get('/healthz', (req, res) => {
  const health = checkHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

## Estimated Time

< 15 minutes

## Dependencies

- Story 004 (DatabaseManager)
- Existing health check infrastructure

