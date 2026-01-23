import { describe, it, expect } from 'vitest';
import { calculateNextExpanded } from './treeUtils';
import { IssueTimeline } from './transformers';

describe('Tree Utils', () => {
    // Helper to create minimal node
    const createNode = (key: string, issueType: string, children: IssueTimeline[] = []): IssueTimeline => ({
        key,
        issueType,
        summary: 'test',
        segments: [],
        totalCycleTime: 0,
        depth: 0,
        hasChildren: children.length > 0,
        subRows: children,
    });

    const mockTree = [
        createNode('EPIC-1', 'Epic', [
            createNode('STORY-1', 'Story', [
                createNode('SUB-1', 'Sub-task')
            ]),
            createNode('BUG-1', 'Bug', [
                createNode('SUB-2', 'Sub-task')
            ])
        ]),
        createNode('TASK-1', 'Task', []), // No children
    ];

    it('should collapse stories when they are currently expanded (areSubtasksVisible=true)', () => {
        // Assume everything is expanded initially
        const currentExpanded = true;
        
        const { nextExpanded, nextAreSubtasksVisible } = calculateNextExpanded(
            currentExpanded, 
            mockTree, 
            true // currently visible
        );

        expect(nextAreSubtasksVisible).toBe(false);
        // STORY-1 and BUG-1 are parents (Story/Bug) so they should be toggled to false
        expect(nextExpanded['STORY-1']).toBe(false);
        expect(nextExpanded['BUG-1']).toBe(false);
        
        // EPIC-1 should remain true (expanded from 'true' state)
        expect(nextExpanded['EPIC-1']).toBe(true);
    });

    it('should expand stories when they are currently collapsed (areSubtasksVisible=false)', () => {
        const currentExpanded = { 'EPIC-1': true, 'STORY-1': false };
        
        const { nextExpanded, nextAreSubtasksVisible } = calculateNextExpanded(
            currentExpanded, 
            mockTree, 
            false // currently hidden
        );

        expect(nextAreSubtasksVisible).toBe(true);
        expect(nextExpanded['STORY-1']).toBe(true);
        expect(nextExpanded['BUG-1']).toBe(true); // Was undefined/false, now true
    });

    it('should not toggle Epics', () => {
        const { nextExpanded } = calculateNextExpanded(
            true, 
            mockTree, 
            true
        );
        // Epic should stay true
        expect(nextExpanded['EPIC-1']).toBe(true);
    });
});
