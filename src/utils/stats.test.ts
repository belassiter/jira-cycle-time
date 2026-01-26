import { describe, it, expect } from 'vitest';
import { calculateIssueStats, formatMetric } from './stats';
import { IssueTimeline } from './transformers';

describe('Stats Logic - Advanced Requirements', () => {
    // Helper to create mock issues
    const createMock = (key: string, parentId: string | undefined, cycleTime: number, start: Date, end: Date, type: string = 'Story'): IssueTimeline => ({
        key,
        summary: `Summary ${key}`,
        parentId,
        hasChildren: false, // Updated dynamically usually, but manually here if needed
        totalCycleTime: cycleTime,
        segments: [{ start, end, status: 'In Progress', durationDays: cycleTime }],
        depth: parentId ? 1 : 0,
        url: '',
        issueType: type,
        subRows: []
    });

    const now = new Date('2024-01-26T12:00:00'); // Friday
    const oneDayAgo = new Date('2024-01-25T12:00:00'); // Thursday
    const tenDaysAgo = new Date('2024-01-16T12:00:00');

    it('should format metrics correctly based on magnitude', () => {
        expect(formatMetric(5.123)).toBe('5.1');
        expect(formatMetric(5.0)).toBe('5'); // "No more than one decimal". 5.0 -> 5 is usually preferred or 5.0? User: "Never show more than one". Doesn't force 1.
        // User: "If the value is >=10, show no decimal places." implies <10 CAN show decimals.
        // Let's assume 5.1 is good. 5.0 -> 5.0 is fine.
        expect(formatMetric(10.1)).toBe('10');
        expect(formatMetric(12.9)).toBe('13'); // Rounding?
    });

    it('should calculate global cycle time spanning all descendants', () => {
        // Parent: 2 days (Thu-Fri)
        const parent = createMock('PARENT', undefined, 2, oneDayAgo, now, 'Story'); 
        parent.hasChildren = true;
        
        // Child 1: Started 10 days ago, ended 10 days ago (1 day).
        const child = createMock('CHILD', 'PARENT', 1, tenDaysAgo, tenDaysAgo, 'Sub-task');

        const data = [parent, child];
        const selection = { 'PARENT': true };

        // Real Cycle Time logic uses calculateCycleTime(start, end)
        // Global Start: tenDaysAgo. Global End: now.
        // Diff: approx 10 days (assuming work days, checks weekends).
        // 16th (Tue) to 26th (Fri). 
        // 16, 17, 18, 19 (Fri) = 4 days
        // 20, 21 (Weekend)
        // 22, 23, 24, 25, 26 = 5 days
        // Total ~9 days.
        
        // We need to mock calculateCycleTime or trust the integration? 
        // ideally unit test stats logic.
        // I will trust the integration uses the util.
        
        // The test mainly verifies we picked the right Dates to feed into the calculator.
        // But calculateIssueStats calls calculateCycleTime internally. 
        
        const stats = calculateIssueStats(selection, data);
        
        // We expect Cycle Time to be significantly larger than just the parent's 2 days.
        expect(stats?.cycleTime).toBeGreaterThan(5); 
    });

    it('should determine correct child level title', () => {
        const epic = createMock('EPIC', undefined, 0, now, now, 'Epic');
        epic.hasChildren = true;
        const story = createMock('STORY', 'EPIC', 0, now, now, 'Story');
        
        const statsEpic = calculateIssueStats({ 'EPIC': true }, [epic, story]);
        expect(statsEpic?.childLevel).toBe('Story/Task');

        const task = createMock('TASK', undefined, 0, now, now, 'Task');
        task.hasChildren = true;
        const sub = createMock('SUB', 'TASK', 0, now, now, 'Sub-task');
        
        const statsTask = calculateIssueStats({ 'TASK': true }, [task, sub]);
        expect(statsTask?.childLevel).toBe('Sub-task');
    });

    it('should calculate Average and StdDev ignoring zeros', () => {
         const parent = createMock('P', undefined, 0, now, now);
         parent.hasChildren = true;
         // Children with 4, 6, 0 cycle time
         const c1 = createMock('C1', 'P', 4, now, now, 'Sub-task');
         const c2 = createMock('C2', 'P', 6, now, now, 'Sub-task');
         const c3 = createMock('C3', 'P', 0, now, now, 'Sub-task');

         const stats = calculateIssueStats({ 'P': true }, [parent, c1, c2, c3]);
         
         // Avg of 4 and 6 is 5.
         // StdDev: Mean=5. (4-5)^2 + (6-5)^2 = 1 + 1 = 2. Variance = 2 / (2-1) = 2. StdDev = 1.414... -> 1.4
         expect(stats?.average).toBe("5 ± 1.4 work days");
    });
});
