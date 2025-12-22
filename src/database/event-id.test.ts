import { describe, it, expect } from 'vitest';
import { generateEventId, isValidEventId } from './event-id.js';

describe('generateEventId', () => {
  it('returns string in correct format', () => {
    const id = generateEventId();
    
    expect(typeof id).toBe('string');
    expect(id.startsWith('evt_')).toBe(true);
    expect(isValidEventId(id)).toBe(true);
  });

  it('includes date component', () => {
    const id = generateEventId();
    const parts = id.split('_');
    
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe('evt');
    expect(parts[1].length).toBe(8);
    expect(/^\d{8}$/.test(parts[1])).toBe(true);
  });

  it('includes time component', () => {
    const id = generateEventId();
    const parts = id.split('_');
    
    expect(parts[2].length).toBe(6);
    expect(/^\d{6}$/.test(parts[2])).toBe(true);
  });

  it('includes random component', () => {
    const id = generateEventId();
    const parts = id.split('_');
    
    expect(parts[3].length).toBe(6);
    expect(/^[a-f0-9]{6}$/.test(parts[3])).toBe(true);
  });

  it('generates unique IDs', () => {
    const id1 = generateEventId();
    const id2 = generateEventId();
    const id3 = generateEventId();
    
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('IDs are lexicographically sortable', async () => {
    const id1 = generateEventId();
    
    // Wait 1100ms to ensure different timestamp (IDs have second precision)
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const id2 = generateEventId();
    
    expect(id1 < id2).toBe(true);
  });

  it('date format is correct', () => {
    const id = generateEventId();
    const parts = id.split('_');
    const dateStr = parts[1];
    
    // Parse date string YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));
    
    const now = new Date();
    
    expect(year).toBe(now.getUTCFullYear());
    expect(month).toBe(now.getUTCMonth() + 1);
    expect(day).toBe(now.getUTCDate());
  });

  it('time format is reasonable', () => {
    const id = generateEventId();
    const parts = id.split('_');
    const timeStr = parts[2];
    
    // Parse time string HHMMSS
    const hour = parseInt(timeStr.substring(0, 2));
    const minute = parseInt(timeStr.substring(2, 4));
    const second = parseInt(timeStr.substring(4, 6));
    
    expect(hour >= 0 && hour < 24).toBe(true);
    expect(minute >= 0 && minute < 60).toBe(true);
    expect(second >= 0 && second < 60).toBe(true);
  });

  it('produces IDs with correct total length', () => {
    const id = generateEventId();
    
    // evt_ + 8 + _ + 6 + _ + 6 = 26 characters
    expect(id.length).toBe(26);
  });

  it.skip('batch generation creates unique IDs', () => {
    const ids = new Set<string>();
    const count = 1000;
    
    for (let i = 0; i < count; i++) {
      ids.add(generateEventId());
    }
    
    expect(ids.size).toBe(count);
  });
});

describe('isValidEventId', () => {
  it('validates correct format', () => {
    const validId = 'evt_20251202_103045_a7f3b9';
    
    expect(isValidEventId(validId)).toBe(true);
  });

  it('rejects invalid formats', () => {
    const invalidIds = [
      'invalid',
      'evt_',
      'evt_20251202',
      'evt_20251202_103045',
      'evt_20251202_103045_',
      'evt_20251202_103045_xyz', // non-hex
      'evt_20251202_103045_a7f3b', // too short
      'evt_20251202_103045_a7f3b99', // too long
      'evt_2025120_103045_a7f3b9', // date too short
      'evt_20251202_10304_a7f3b9', // time too short
      'evt_20251202_103045_A7F3B9', // uppercase not allowed
    ];
    
    for (const id of invalidIds) {
      expect(isValidEventId(id)).toBe(false);
    }
  });

  it('validates generated IDs', () => {
    for (let i = 0; i < 10; i++) {
      const id = generateEventId();
      expect(isValidEventId(id)).toBe(true);
    }
  });
});
