import { describe, it, expect } from 'vitest';
import { processIssueTimeline, filterTimelineStatuses, processParentsAndChildren, filterTimelineByIssueType } from './transformers';

describe('processIssueTimeline', () => {
    it('should create a timeline from basic issue data', () => {
        const mockIssue = {
            key: 'TEST-123',
            fields: {
                summary: 'Test Issue',
                created: '2023-01-01T10:00:00.000Z',
                status: { name: 'To Do' }
            },
            changelog: {
                histories: []
            }
        };

        const result = processIssueTimeline(mockIssue);

        expect(result.key).toBe('TEST-123');
        expect(result.segments.length).toBeGreaterThan(0);
        // Should have at least one segment from Created -> Now
        expect(result.segments[0].status).toBe('To Do');
    });

    it('should handle "cleaned" data missing the fields wrapper', () => {
        // Electron sends: { key, summary, status: 'To Do', created: ..., changelog: ... }
        const cleanIssue = {
            key: 'TEST-CLEAN',
            summary: 'Clean Issue',
            status: 'In Progress', // Direct property
            created: '2023-01-01T10:00:00.000Z',
            changelog: { histories: [] }
        };

        const result = processIssueTimeline(cleanIssue);
        
        expect(result.key).toBe('TEST-CLEAN');
        expect(result.summary).toBe('Clean Issue');
        expect(result.segments[0].status).toBe('In Progress');
    });
});

describe('processParentsAndChildren', () => {
    it('should flatten hierarchy and assign depth', () => {
        const flatIssues = [
            { key: 'EPIC-1', created: '2023-01-01', status: 'Open' },
            { key: 'STORY-1', parentKey: 'EPIC-1', created: '2023-01-02', status: 'Open' },
            { key: 'SUB-1', parentKey: 'STORY-1', created: '2023-01-03', status: 'Open' },
            { key: 'EPIC-2', created: '2023-01-01', status: 'Open' } // Orphan sibling
        ];

        const result = processParentsAndChildren(flatIssues);

        // Expected order: EPIC-1 -> STORY-1 -> SUB-1 -> EPIC-2
        expect(result[0].key).toBe('EPIC-1');
        expect(result[0].depth).toBe(0);
        expect(result[0].hasChildren).toBe(true);

        expect(result[1].key).toBe('STORY-1');
        expect(result[1].depth).toBe(1);
        expect(result[1].parentId).toBe('EPIC-1');

        expect(result[2].key).toBe('SUB-1');
        expect(result[2].depth).toBe(2);

        expect(result[3].key).toBe('EPIC-2');
        expect(result[3].depth).toBe(0);
    });
});

describe('filterTimelineStatuses', () => {
  it('should remove specified statuses', () => {
    const mockTimeline = {
      key: 'TEST-123',
      summary: 'Test',
      totalCycleTime: 0,
      depth: 0,
      hasChildren: false,
      segments: [
        { status: 'To Do', start: new Date('2023-01-01'), end: new Date('2023-01-02'), durationDays: 1 },
        { status: 'In Progress', start: new Date('2023-01-02'), end: new Date('2023-01-05'), durationDays: 3 },
        { status: 'Done', start: new Date('2023-01-05'), end: new Date('2023-01-06'), durationDays: 1 }
      ]
    };

    const filtered = filterTimelineStatuses([mockTimeline], ['To Do', 'Done']);

    expect(filtered[0].segments).toHaveLength(1);
    expect(filtered[0].segments[0].status).toBe('In Progress');
  });

  it('should return empty segments if all filtered out', () => {
    const mockTimeline = {
      key: 'TEST-123',
      summary: 'Test',
      totalCycleTime: 0,
      depth: 0,
      hasChildren: false,
      segments: [
        { status: 'To Do', start: new Date('2023-01-01'), end: new Date('2023-01-02'), durationDays: 1 }
      ]
    };
    
    const filtered = filterTimelineStatuses([mockTimeline], ['To Do']);
    expect(filtered[0].segments).toHaveLength(0);
  });

  it('handles whitespace and case sensitivity in statuses', () => {
    const mockTimeline = {
      key: 'TEST-2',
      summary: 'Test with messy statuses',
      totalCycleTime: 0,
      depth: 0,
      hasChildren: false,
      segments: [
        { status: ' To Do ', start: new Date(), end: new Date(), durationDays: 1 }, // Spaces
        { status: 'open', start: new Date(), end: new Date(), durationDays: 1 },    // Lowercase
        { status: 'In Progress', start: new Date(), end: new Date(), durationDays: 1 },
      ]
    };

    // Filter should catch 'To Do' despite spaces, and 'Open' despite case
    const filtered = filterTimelineStatuses([mockTimeline], ['To Do', 'Open']);
    expect(filtered[0].segments).toHaveLength(1);
    expect(filtered[0].segments[0].status).toBe('In Progress');
  });

  it('updates totalCycleTime after filtering', () => {
    const mockTimeline = {
      key: 'TEST-3',
      summary: 'Cycle Time Recalc',
      totalCycleTime: 10,
      depth: 0,
      hasChildren: false,
      segments: [
        { status: 'To Do', start: new Date(), end: new Date(), durationDays: 2 },
        { status: 'In Progress', start: new Date(), end: new Date(), durationDays: 5 },
        { status: 'Done', start: new Date(), end: new Date(), durationDays: 3 },
      ]
    };

    // Filter "To Do" (2) and "Done" (3). Remaining: "In Progress" (5).
    const filtered = filterTimelineStatuses([mockTimeline], ['To Do', 'Done']);
    
    expect(filtered[0].segments).toHaveLength(1);
    expect(filtered[0].totalCycleTime).toBe(5);
  });
});

describe('filterTimelineByIssueType', () => {
  it('cascades exclusion from parent to children', () => {
    const timeline: any[] = [
      { key: 'TASK-1', issueType: 'Task', summary: 'Task 1', segments: [] },
      { key: 'SUB-1', issueType: 'Sub-task', summary: 'Sub 1', segments: [] },
      { key: 'STORY-1', issueType: 'Story', summary: 'Story 1', segments: [] },
      { key: 'SUB-2', issueType: 'Sub-task', summary: 'Sub 2', segments: [] }
    ];
    const relationsMap = new Map<string, string[]>([
      ['TASK-1', ['SUB-1']],
      ['STORY-1', ['SUB-2']]
    ]);
    const excludedTypes = ['Task']; // Exclude Tasks
    
    const filtered = filterTimelineByIssueType(timeline, excludedTypes, relationsMap);
    
    const keys = filtered.map(item => item.key);
    // Both Task 1 and its descendant Sub 1 should be gone
    expect(keys).not.toContain('TASK-1');
    expect(keys).not.toContain('SUB-1');
    // Story 1 and its descendant Sub 2 should remain
    expect(keys).toContain('STORY-1');
    expect(keys).toContain('SUB-2');
  });

  it('cascades exclusion multiple levels deep', () => {
    const timeline: any[] = [
      { key: 'GRAND-1', issueType: 'Epic', summary: 'GP', segments: [] },
      { key: 'PARENT-1', issueType: 'Story', summary: 'P', segments: [] },
      { key: 'CHILD-1', issueType: 'Sub-task', summary: 'C', segments: [] }
    ];
    const relationsMap = new Map<string, string[]>([
      ['GRAND-1', ['PARENT-1']],
      ['PARENT-1', ['CHILD-1']]
    ]);
    
    // Exclude Epic -> Parent and Child should also go
    const filtered = filterTimelineByIssueType(timeline, ['Epic'], relationsMap);
    expect(filtered.length).toBe(0);
  });
});


