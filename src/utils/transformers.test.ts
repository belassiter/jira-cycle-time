import { describe, it, expect } from 'vitest';
import { processIssueTimeline } from './transformers';

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
