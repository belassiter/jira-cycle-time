
import { describe, it, expect } from 'vitest';
import { sortIssueTimelines, IssueTimeline } from './transformers';

describe('sortIssueTimelines', () => {
    it('should sort siblings by start date', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-02');

        const siblingA = { 
            key: 'A', 
            segments: [{ start: date2, end: date2, status: 'Active', durationDays: 1 }],
            summary: 'A', totalCycleTime: 0, depth: 0, hasChildren: false
        } as IssueTimeline;
        
        const siblingB = { 
            key: 'B', 
            segments: [{ start: date1, end: date1, status: 'Active', durationDays: 1 }],
            summary: 'B', totalCycleTime: 0, depth: 0, hasChildren: false
        } as IssueTimeline;

        // B starts before A. Should be [B, A].
        const sorted = sortIssueTimelines([siblingA, siblingB]);
        
        expect(sorted[0].key).toBe('B');
        expect(sorted[1].key).toBe('A');
    });

    it('should sort siblings without data by key', () => {
        const siblingA = { key: 'Z', segments: [], summary: 'Z', totalCycleTime: 0, depth: 0, hasChildren: false } as IssueTimeline;
        const siblingB = { key: 'A', segments: [], summary: 'A', totalCycleTime: 0, depth: 0, hasChildren: false } as IssueTimeline;

        // B comes before A alphabetically.
        const sorted = sortIssueTimelines([siblingA, siblingB]);

        expect(sorted[0].key).toBe('A'); // B is key 'A'
        expect(sorted[1].key).toBe('Z');
    });
});
