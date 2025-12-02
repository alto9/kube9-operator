/**
 * Event ID Generation - Sortable timestamp-based identifiers
 */

import { randomBytes } from 'crypto';

/**
 * Generates a sortable event ID with format: evt_YYYYMMDD_HHMMSS_<random>
 * 
 * Examples:
 * - evt_20251202_103045_a7f3b9
 * - evt_20251202_103046_x9y8z7
 * 
 * The timestamp portion ensures chronological sorting.
 * The random suffix prevents collisions.
 */
export function generateEventId(): string {
  const now = new Date();
  
  // Format: YYYYMMDD
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Format: HHMMSS
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  
  // Generate 6-character random suffix (alphanumeric lowercase)
  const random = randomBytes(3).toString('hex');
  
  return `evt_${date}_${time}_${random}`;
}

/**
 * Validates an event ID format
 */
export function isValidEventId(id: string): boolean {
  const pattern = /^evt_\d{8}_\d{6}_[a-f0-9]{6}$/;
  return pattern.test(id);
}

