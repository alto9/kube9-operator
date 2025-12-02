/**
 * CLI Status Command
 */

import { formatOutput } from '../formatters.js';
import { DatabaseManager } from '../../database/manager.js';
import { SchemaManager } from '../../database/schema.js';

interface StatusOptions {
  format: string;
}

export async function queryStatus(options: StatusOptions) {
  try {
    // Initialize database  
    const dbManager = DatabaseManager.getInstance();
    const schema = new SchemaManager();
    schema.initialize();
    
    const db = dbManager.getDatabase();
    
    // Get event counts for status
    const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    const recentEvents = db.prepare(
      `SELECT COUNT(*) as count FROM events WHERE created_at >= datetime('now', '-24 hours')`
    ).get() as { count: number };
    
    const status = {
      status: 'operational',
      database: 'connected',
      total_events: totalEvents.count,
      events_24h: recentEvents.count,
      database_path: dbManager.getDbPath(),
      timestamp: new Date().toISOString()
    };
    
    const output = formatOutput(status, options.format);
    console.log(output);
    
    process.exit(0);
  } catch (error: any) {
    console.error(JSON.stringify({
      error: 'Failed to query status',
      details: error.message,
    }));
    process.exit(1);
  }
}

