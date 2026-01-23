
import { describe, it, expect } from 'vitest';
import { processParentsAndChildren, filterTimelineStatuses, buildIssueTree } from './transformers';

describe('End-to-End Data Transformation', () => {
    it('should correctly link parent and child through the full pipeline', () => {
        // 1. Mock Backend Response (Shape from electron/main.ts)
        const backendData = [
            {
                key: 'PARENT-1',
                summary: 'Parent Issue',
                status: 'In Progress',
                created: '2023-01-01',
                issueType: 'Epic',
                parentKey: undefined,
                changelog: { histories: [] }
            },
            {
                key: 'CHILD-1',
                summary: 'Child Issue',
                status: 'In Progress',
                created: '2023-01-02',
                issueType: 'Story',
                parentKey: 'PARENT-1', // Defined in backend response
                changelog: { histories: [] }
            }
        ];

        // 2. processParentsAndChildren
        // This function flattens the tree (DFS) but also normalizes props
        const timelines = processParentsAndChildren(backendData);

        const parentTv = timelines.find(t => t.key === 'PARENT-1');
        const childTv = timelines.find(t => t.key === 'CHILD-1');

        expect(parentTv).toBeDefined();
        expect(childTv).toBeDefined();
        
        // CHECK 1: Is parentId set correctly?
        expect(childTv?.parentId).toBe('PARENT-1');

        // 3. filterTimelineStatuses
        const filtered = filterTimelineStatuses(timelines, []);
        const filteredChild = filtered.find(t => t.key === 'CHILD-1');
        
        // CHECK 2: Is parentId preserved?
        expect(filteredChild?.parentId).toBe('PARENT-1');

        // 4. buildIssueTree
        // This is what the Table uses
        const tree = buildIssueTree(filtered);

        expect(tree.length).toBe(1); // Should be 1 root
        expect(tree[0].key).toBe('PARENT-1');
        expect(tree[0].subRows).toBeDefined();
        expect(tree[0].subRows?.length).toBe(1);
        expect(tree[0].subRows?.[0].key).toBe('CHILD-1');
    });
});
