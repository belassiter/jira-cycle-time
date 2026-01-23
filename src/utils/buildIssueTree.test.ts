
import { describe, it, expect } from 'vitest';
import { buildIssueTree } from './transformers';

describe('buildIssueTree', () => {
    it('should nest children under parents', () => {
        const flatIssues: any[] = [
            { key: 'A', parentId: undefined, summary: 'Root A', segments: [], totalCycleTime: 0, depth: 0, hasChildren: true },
            { key: 'B', parentId: 'A', summary: 'Child B', segments: [], totalCycleTime: 0, depth: 1, hasChildren: false },
            { key: 'C', parentId: 'A', summary: 'Child C', segments: [], totalCycleTime: 0, depth: 1, hasChildren: true },
            { key: 'D', parentId: 'C', summary: 'Grandchild D', segments: [], totalCycleTime: 0, depth: 2, hasChildren: false },
        ];

        const tree = buildIssueTree(flatIssues);
        
        expect(tree.length).toBe(1);
        expect(tree[0].key).toBe('A');
        expect(tree[0].subRows?.length).toBe(2);
        
        const childB = tree[0].subRows?.find(x => x.key === 'B');
        const childC = tree[0].subRows?.find(x => x.key === 'C');
        
        expect(childB).toBeDefined();
        expect(childC).toBeDefined();
        
        expect(childC?.subRows?.length).toBe(1);
        expect(childC?.subRows?.[0].key).toBe('D');
    });

    it('should handle orphans as roots', () => {
        const flatIssues: any[] = [
            { key: 'A', parentId: undefined, segments: [] },
            { key: 'B', parentId: 'X', segments: [] }, // X does not exist
        ];

        const tree = buildIssueTree(flatIssues);
        expect(tree.length).toBe(2);
        expect(tree.find(x => x.key === 'A')).toBeDefined();
        expect(tree.find(x => x.key === 'B')).toBeDefined();
    });
});
