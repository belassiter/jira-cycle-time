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
        // SELECT ALL to include them in the new hierarchical logic
        const selection = { 'PARENT': true, 'CHILD': true };
        
        const stats = calculateIssueStats(selection, data);
        
        // We expect Cycle Time to be significantly larger than just the parent's 2 days.
        expect(stats?.totalCycleTime).toBeGreaterThan(5); 
    });

    it('should determine correct child level title', () => {
        const epic = createMock('EPIC', undefined, 0, now, now, 'Epic');
        epic.hasChildren = true;
        const story = createMock('STORY', 'EPIC', 0, now, now, 'Story');
        
        const statsEpic = calculateIssueStats({ 'EPIC': true, 'STORY': true }, [epic, story]);
        expect(statsEpic?.storyStats).toBeDefined();

        const task = createMock('TASK', undefined, 0, now, now, 'Task');
        task.hasChildren = true;
        const sub = createMock('SUB', 'TASK', 1, now, now, 'Sub-task');
        
        const statsTask = calculateIssueStats({ 'TASK': true, 'SUB': true }, [task, sub]);
        expect(statsTask?.subTaskStats).toBeDefined();
    });

    it('should calculate Average and StdDev ignoring zeros', () => {
         const parent = createMock('P', undefined, 0, now, now);
         parent.hasChildren = true;
         // Children with 4, 6, 0 cycle time
         const c1 = createMock('C1', 'P', 4, now, now, 'Sub-task');
         const c2 = createMock('C2', 'P', 6, now, now, 'Sub-task');
         const c3 = createMock('C3', 'P', 0, now, now, 'Sub-task');

         const stats = calculateIssueStats({ 'P': true, 'C1': true, 'C2': true, 'C3': true }, [parent, c1, c2, c3]);
         
         // Avg of 4 and 6 is 5.
         // StdDev: Mean=5. (4-5)^2 + (6-5)^2 = 1 + 1 = 2. Variance = 2 / (2-1) = 2. StdDev = 1.414... -> 1.4
         expect(stats?.subTaskStats?.globalAverage).toBe("5 ± 1.4 work days");
    });

    describe('Sub-task Grouping Stats', () => {
        const GROUPS = [
            { id: 'dev', name: 'Dev', keywords: ['dev'] },
            { id: 'test', name: 'Test', keywords: ['test'] }
        ];

        it('should calculate statistics per group', () => {
             const parent = { ...createMock('P', undefined, 0, now, now, 'Epic'), hasChildren: true };
             
             // Dev Group: 10 days
             const c1 = { ...createMock('C1', 'P', 10, now, new Date(now.getTime() + (10*86400000)), 'Sub-task'), summary: 'dev work' };
             
             // Test Group: 20 days
             const c2 = { ...createMock('C2', 'P', 20, now, new Date(now.getTime() + (20*86400000)), 'Sub-task'), summary: 'testing' };

             const selection = { 'P': true, 'C1': true, 'C2': true };
             const stats = calculateIssueStats(selection, [parent, c1, c2], undefined, GROUPS as any);
             
             expect(stats?.subTaskStats?.groups).toBeDefined();
             expect(stats?.subTaskStats?.groups).toHaveLength(2);
             
             const devGroup = stats?.subTaskStats?.groups.find(g => g.groupName === 'Dev');
             const testGroup = stats?.subTaskStats?.groups.find(g => g.groupName === 'Test');
             
             expect(devGroup?.average).toBe(10);
             expect(testGroup?.average).toBe(20);
             
             expect(stats?.subTaskStats?.longestGroup?.groupName).toBe('Test');
        });

        it('should determine the "Last" group correctly', () => {
             const parent = { ...createMock('P', undefined, 0, now, now, 'Epic'), hasChildren: true };
             
             const t1 = new Date('2024-01-01');
             const t2 = new Date('2024-01-05');
             const t3 = new Date('2024-01-10');

             // Group A ends on t2
             const c1 = { ...createMock('C1', 'P', 5, t1, t2, 'Sub-task'), summary: 'group a' };
             
             // Group B ends on t3 (Latest)
             const c2 = { ...createMock('C2', 'P', 5, t2, t3, 'Sub-task'), summary: 'group b' };

             const groups = [
                 { id: 'a', name: 'A', keywords: ['a'] },
                 { id: 'b', name: 'B', keywords: ['b'] }
             ];

             const selection = { 'P': true, 'C1': true, 'C2': true };
             const stats = calculateIssueStats(selection, [parent, c1, c2], undefined, groups as any);
             expect(stats?.subTaskStats?.lastGroup?.groupName).toBe('B');
        });
    });
});
