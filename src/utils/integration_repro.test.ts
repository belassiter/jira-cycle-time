
import { describe, it, expect } from 'vitest';
import { processParentsAndChildren, filterTimelineStatuses, buildIssueTree } from './transformers';

describe('Integration Flow', () => {
    it('should correctly nest issues when transforming from backend data', () => {
        // 1. Raw Data from Backend (Mock)
        const rawData = [
            { 
                key: 'PARENT-1', 
                fields: { summary: 'Parent', status: { name: 'In Progress' }, created: '2023-01-01' }, 
                parentKey: undefined,
                changelog: { histories: [] }
            },
            { 
                key: 'CHILD-1', 
                fields: { summary: 'Child', status: { name: 'To Do' }, created: '2023-01-02' }, 
                parentKey: 'PARENT-1',
                changelog: { histories: [] }
            }
        ];

        // 2. processParentsAndChildren
        const flattened = processParentsAndChildren(rawData);
        
        // Assert we have standard properties
        const parent = flattened.find(x => x.key === 'PARENT-1');
        const child = flattened.find(x => x.key === 'CHILD-1');
        
        expect(parent).toBeDefined();
        expect(child).toBeDefined();
        
        // CRITICAL CHECK: Does the flattened output have 'parentId'?
        expect(child?.parentId).toBe('PARENT-1'); 

        // 3. filterTimelineStatuses
        const filtered = filterTimelineStatuses(flattened, []);
        
        // 4. buildIssueTree
        const tree = buildIssueTree(filtered);

        // FAIL CONDITION CHECK
        expect(tree.length).toBe(1); // Should only have 1 root
        expect(tree[0].key).toBe('PARENT-1');
        expect(tree[0].subRows).toBeDefined();
        expect(tree[0].subRows?.length).toBe(1);
        expect(tree[0].subRows?.[0].key).toBe('CHILD-1');
    });
});
