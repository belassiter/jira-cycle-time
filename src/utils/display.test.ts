import { describe, it, expect } from 'vitest';
import { generateMondayTicks } from './display';
import { isMonday } from 'date-fns';

describe('generateMondayTicks', () => {
  it('should only return dates that are Mondays', () => {
    const start = new Date('2023-01-01'); // Sunday
    const end = new Date('2023-01-31');
    
    const ticks = generateMondayTicks(start, end);
    
    expect(ticks.length).toBeGreaterThan(0);
    ticks.forEach(date => {
      expect(isMonday(date)).toBe(true);
    });
  });

  it('should include the first Monday even if start date is mid-week', () => {
    const start = new Date('2023-01-04'); // Wednesday
    const end = new Date('2023-01-15');
    
    const ticks = generateMondayTicks(start, end);
    // Should find Monday Jan 2nd (before start) or Jan 9th?
    // Usually visualization ticks should cover the start.
    // startOfWeek(Jan 4, Mon) = Jan 2.
    expect(ticks[0].toISOString()).toContain('2023-01-02');
  });
});
