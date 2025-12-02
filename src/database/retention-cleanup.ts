/**
 * Retention Cleanup - Scheduled job for deleting old events
 */

import { DatabaseManager } from './manager.js';
import Database from 'better-sqlite3';
import { logger } from '../logging/logger.js';

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
    
    logger.info('Retention cleanup job started (runs every 6 hours)');
  }

  /**
   * Stop scheduled cleanup job
   */
  public stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Retention cleanup job stopped');
    }
  }

  /**
   * Run cleanup immediately (can be called manually)
   */
  public runCleanup(): number {
    try {
      const deletedInfo = this.cleanupInfoWarningEvents();
      const deletedCritical = this.cleanupErrorCriticalEvents();
      
      const total = deletedInfo + deletedCritical;
      
      logger.info(`Retention cleanup completed: deleted ${total} events (${deletedInfo} info/warning, ${deletedCritical} error/critical)`);
      
      return total;
    } catch (error: any) {
      logger.error('Retention cleanup failed', { error: error.message });
      return 0;
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

