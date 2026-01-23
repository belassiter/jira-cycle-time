import { describe, it, expect } from 'vitest';
import { getTimelinePosition, getTimelineWidth } from './timelineLayout';
import { addMinutes } from 'date-fns';

describe('Timeline Layout Math', () => {
    const minDate = new Date('2024-01-01T00:00:00');
    // total of 1000 minutes context
    const totalMinutes = 1000; 

    it('should place minDate at 0%', () => {
        const pos = getTimelinePosition(minDate, minDate, totalMinutes);
        expect(pos).toBe(0);
    });

    it('should place date halfway through at 50%', () => {
        const target = addMinutes(minDate, 500);
        const pos = getTimelinePosition(target, minDate, totalMinutes);
        expect(pos).toBe(50);
    });

    it('should place date at end at 100%', () => {
        const target = addMinutes(minDate, 1000);
        const pos = getTimelinePosition(target, minDate, totalMinutes);
        expect(pos).toBe(100);
    });

    it('should handle dates before minDate (negative percent)', () => {
        const target = addMinutes(minDate, -100);
        const pos = getTimelinePosition(target, minDate, totalMinutes);
        expect(pos).toBe(-10);
    });

    it('should handle zero duration correctly', () => {
        const w = getTimelineWidth(minDate, minDate, totalMinutes);
        expect(w).toBe(0);
    });

    it('should calculate width for 10% duration', () => {
        const end = addMinutes(minDate, 100);
        const w = getTimelineWidth(minDate, end, totalMinutes);
        expect(w).toBe(10);
    });
    
    it('should match position delta to width', () => {
        const start = addMinutes(minDate, 200);
        const end = addMinutes(minDate, 400); // 200 min duration
        
        const posStart = getTimelinePosition(start, minDate, totalMinutes); // 20%
        const posEnd = getTimelinePosition(end, minDate, totalMinutes); // 40%
        const width = getTimelineWidth(start, end, totalMinutes); // 20%
        
        expect(posEnd - posStart).toBeCloseTo(width);
    });
});
