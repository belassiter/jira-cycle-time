import { describe, it, expect } from 'vitest';
import { processIssueTimeline, filterTimelineStatuses, sortIssueTimelines } from './transformers';

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
});

describe('filterTimelineStatuses', () => {
  it('should remove specified statuses', () => {
    const mockTimeline = {
      key: 'TEST-123',
      summary: 'Test',
      totalCycleTime: 0,
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

describe('sortIssueTimelines', () => {
  it('correctly sorts timelines', () => {
    // Parent
    const parent = { key: 'PARENT-1', segments: [] } as any;
    
    // Children with data
    const childEarly = { key: 'CHILD-1', segments: [{ start: new Date('2023-01-01') }] } as any;
    const childLate = { key: 'CHILD-2', segments: [{ start: new Date('2023-01-05') }] } as any;
    
    // Children without data
    const childNoDataA = { key: 'ALPHA-1', segments: [] } as any;
    const childNoDataB = { key: 'BETA-1', segments: [] } as any;
    
    // Random input order
    const input = [parent, childNoDataB, childLate, childEarly, childNoDataA];
    
    const sorted = sortIssueTimelines(input);
    
    // Expect: Parent, Early, Late, Alpha, Beta
    expect(sorted[0].key).toBe('PARENT-1');
    expect(sorted[1].key).toBe('CHILD-1');
    expect(sorted[2].key).toBe('CHILD-2');
    expect(sorted[3].key).toBe('ALPHA-1');
    expect(sorted[4].key).toBe('BETA-1');
  });
});
