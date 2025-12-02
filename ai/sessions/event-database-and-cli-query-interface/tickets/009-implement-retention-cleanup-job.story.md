---
story_id: 009-implement-retention-cleanup-job
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: pending
---

# Story: Implement Event Retention Cleanup Job

## Objective

Create a scheduled job that deletes old events based on retention policy (7 days for info/warning, 30 days for error/critical).

## Acceptance Criteria

- [ ] `RetentionCleanup` class created
- [ ] Deletes info/warning events older than 7 days
- [ ] Deletes error/critical events older than 30 days
- [ ] Runs on schedule (every 6 hours)
- [ ] Logs number of events deleted
- [ ] Handles cleanup errors gracefully
- [ ] Can be manually triggered for testing

## Files to Create

- `/home/danderson/code/alto9/opensource/kube9-operator/src/database/retention-cleanup.ts`

## Implementation Notes

### RetentionCleanup Class

```typescript
import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';

export class RetentionCleanup {
  private db: Database.Database;
  private intervalHandle: NodeJS.Timeout | null = null;
  private infoRetentionDays: number;
  private criticalRetentionDays: number;

  constructor(
    infoRetentionDays: number = 7,
    criticalRetentionDays: number = 30
  ) {
    const manager = DatabaseManager.getInstance();
    this.db = manager.getDatabase();
    this.infoRetentionDays = infoRetentionDays;
    this.criticalRetentionDays = criticalRetentionDays;
  }

  /**
   * Start scheduled cleanup job (runs every 6 hours)
   */
  public start(): void {
    const sixHours = 6 * 60 * 60 * 1000;
    
    // Run immediately on start
    this.runCleanup();
    
    // Then schedule for every 6 hours
    this.intervalHandle = setInterval(() => {
      this.runCleanup();
    }, sixHours);
    
    console.log('Retention cleanup job started (runs every 6 hours)');
  }

  /**
   * Stop scheduled cleanup job
   */
  public stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('Retention cleanup job stopped');
    }
  }

  /**
   * Run cleanup immediately (can be called manually)
   */
  public runCleanup(): void {
    try {
      const deletedInfo = this.cleanupInfoWarningEvents();
      const deletedCritical = this.cleanupErrorCriticalEvents();
      
      const total = deletedInfo + deletedCritical;
      
      console.log(`Retention cleanup completed: deleted ${total} events (${deletedInfo} info/warning, ${deletedCritical} error/critical)`);
    } catch (error: any) {
      console.error('Retention cleanup failed:', error.message);
    }
  }

  private cleanupInfoWarningEvents(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.infoRetentionDays);
    const cutoff = cutoffDate.toISOString();
    
    const stmt = this.db.prepare(`
      DELETE FROM events 
      WHERE severity IN ('info', 'warning') 
        AND created_at < ?
    `);
    
    const result = stmt.run(cutoff);
    return result.changes;
  }

  private cleanupErrorCriticalEvents(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.criticalRetentionDays);
    const cutoff = cutoffDate.toISOString();
    
    const stmt = this.db.prepare(`
      DELETE FROM events 
      WHERE severity IN ('error', 'critical') 
        AND created_at < ?
    `);
    
    const result = stmt.run(cutoff);
    return result.changes;
  }
}
```

### Integration in Operator

```typescript
// In operator startup
const retentionCleanup = new RetentionCleanup(7, 30);
retentionCleanup.start();

// In operator shutdown
retentionCleanup.stop();
```

## Estimated Time

< 25 minutes

## Dependencies

- Story 004 (DatabaseManager)
- Story 005 (Schema must exist)

