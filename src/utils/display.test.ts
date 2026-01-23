import { describe, it, expect } from 'vitest';
import { generateMondayTicks, generateSmartTicks } from './display';
import { isMonday, addWeeks, addYears, differenceInWeeks } from 'date-fns';

describe('generateSmartTicks', () => {
    it('should generate weekly ticks for short durations', () => {
        const start = new Date('2023-01-01');
        const end = addWeeks(start, 5); // 5 weeks
        
        const ticks = generateSmartTicks(start, end, 10);
        // Should have 1 tick per week.
        // Difference is 5, plus start, so ~6 ticks.
        expect(ticks.length).toBeGreaterThanOrEqual(5);
        expect(differenceInWeeks(ticks[1], ticks[0])).toBe(1);
    });

    it('should scale step size for long durations', () => {
        const start = new Date('2023-01-01');
        const end = addYears(start, 2); // ~104 weeks
        
        const ticks = generateSmartTicks(start, end, 10);
        
        // Should have <= 10 (or approx close depending on logic) ticks
        // With 104 weeks, step should be:
        // 104 / 1 = 104 > 10
        // 104 / 2 = 52 > 10
        // 104 / 4 = 26 > 10
        // 104 / 8 = 13 > 10
        // 104 / 16 = 6.5 <= 10
        // So step 16.
        
        expect(ticks.length).toBeLessThanOrEqual(12); // Allow slight buffer
        expect(differenceInWeeks(ticks[1], ticks[0])).toBeGreaterThanOrEqual(8); 
    });
});

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
