import { describe, it, expect } from 'vitest';
import { calculateCycleTime } from './cycleTime';

describe('calculateCycleTime', () => {
    it('Example 1: Tue 10am -> Wed 11am (1.125 days)', () => {
        // Tue Jan 7 2025 10:00 PST -> 18:00 UTC
        const start = new Date('2025-01-07T18:00:00Z');
        // Wed Jan 8 2025 11:00 PST -> 19:00 UTC
        const end = new Date('2025-01-08T19:00:00Z');

        const result = calculateCycleTime(start, end);
        expect(result).toBeCloseTo(1.125);
    });

    it('Example 2: Fri 4pm -> Mon 10am (0.25 days)', () => {
        // Fri Jan 10 2025 16:00 PST -> Jan 11 00:00 UTC
        const start = new Date('2025-01-11T00:00:00Z');
        // Mon Jan 13 2025 10:00 PST -> Jan 13 18:00 UTC
        const end = new Date('2025-01-13T18:00:00Z');

        const result = calculateCycleTime(start, end);
        expect(result).toBeCloseTo(0.25);
    });

    it('Excludes Holidays (using holiday.json)', () => {
        // Jan 1 2025 is a holiday (Wednesday)
        // Tue Dec 31 2024 10:00 PST -> Jan 2 2025 10:00 PST
        // Should ignore all of Wed Jan 1.
        // Work: Tue 10-17 (7h) + Thu 9-10 (1h) = 8h = 1 day.
        
        const start = new Date('2024-12-31T18:00:00Z'); // Tue 10am PST
        const end = new Date('2025-01-02T18:00:00Z');   // Thu 10am PST

        const result = calculateCycleTime(start, end);
        expect(result).toBeCloseTo(1.0);
    });

    it('Handles purely outside work hours transitions', () => {
        // Sat -> Sun (0 days)
        const start = new Date('2025-01-11T20:00:00Z'); // Sat 12pm PST
        const end = new Date('2025-01-12T20:00:00Z');   // Sun 12pm PST
        expect(calculateCycleTime(start, end)).toBe(0);
    });
    
    it('Handles start before 9am', () => {
        // Tue 8am -> Tue 10am
        // Should only count 9am-10am (1 hour = 0.125 days)
        const start = new Date('2025-01-07T16:00:00Z'); // 8am PST
        const end = new Date('2025-01-07T18:00:00Z');   // 10am PST
        expect(calculateCycleTime(start, end)).toBeCloseTo(0.125);
    });

    it('Handles end after 5pm', () => {
        // Tue 4pm -> Tue 6pm
        // Should only count 4pm-5pm (1 hour = 0.125 days)
        // const start = new Date('2025-01-07T24:00:00Z'); // Unused
                                                        // Wait, 16:00 PST is 00:00 UTC next day
        // Let's use 16:00 PST on Jan 7 -> Jan 8 00:00:00Z
        const activeStart = new Date('2025-01-08T00:00:00Z'); 
 

        // 6pm PST on Jan 7 -> Jan 8 02:00:00Z
        const activeEnd = new Date('2025-01-08T02:00:00Z');

        expect(calculateCycleTime(activeStart, activeEnd)).toBeCloseTo(0.125);
    });
});
