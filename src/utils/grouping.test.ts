import { describe, it, expect } from 'vitest';
import { groupSubTasks, classifySubTask, SubTaskGroup, OTHER_GROUP_ID } from './grouping';
import { IssueTimeline } from './transformers';

describe('Sub-task Grouping Logic', () => {
    
    const GROUPS: SubTaskGroup[] = [
        { id: 'dev', name: 'Development', keywords: ['dev', 'implement', 'code'] },
        { id: 'test', name: 'Testing', keywords: ['test', 'qa'] },
        { id: 'review', name: 'Review', keywords: ['review'] }
    ];

    it('should classify based on keywords (case insensitive)', () => {
        expect(classifySubTask('Implement Login', GROUPS)).toBe('dev');
        expect(classifySubTask('Write Code', GROUPS)).toBe('dev');
        expect(classifySubTask('QA Verification', GROUPS)).toBe('test');
        expect(classifySubTask('Code Review', GROUPS)).toBe('dev'); // "Code" matches dev first in list? 
        // Wait, "Code Review" has "code" (dev) and "review" (review).
        // First group in list wins.
    });

    it('should fall back to Other if no keywords match', () => {
        expect(classifySubTask('Random Task', GROUPS)).toBe(OTHER_GROUP_ID);
    });

    it('should group sub-tasks correctly', () => {
        const tasks: Partial<IssueTimeline>[] = [
           { key: '1', summary: 'Implement Feature A' },
           { key: '2', summary: 'Test Feature A' },
           { key: '3', summary: 'Documentation' }
        ];

        const grouped = groupSubTasks(tasks as IssueTimeline[], GROUPS);

        expect(grouped['dev']).toHaveLength(1);
        expect(grouped['dev'][0].key).toBe('1');
        
        expect(grouped['test']).toHaveLength(1);
        expect(grouped['test'][0].key).toBe('2');

        expect(grouped[OTHER_GROUP_ID]).toHaveLength(1);
        expect(grouped[OTHER_GROUP_ID][0].key).toBe('3');
    });

    it('should respect group priority order', () => {
         // If "Review" was first, "Code Review" would be Review.
         const reorderedGroups = [
             { id: 'review', name: 'Review', keywords: ['review'] },
             ...GROUPS
         ];
         
         // "Code Review" contains "code" (dev) and "review" (review).
         // Since 'review' group is first now:
         expect(classifySubTask('Code Review', reorderedGroups)).toBe('review');
    });

    describe('Wildcard Matching', () => {
        const WILDCARD_GROUPS: SubTaskGroup[] = [
            { id: 'automation', name: 'Automation', keywords: ['auto*', 'script'] },
            { id: 'embedded', name: 'Embedded', keywords: ['embed*'] }
        ];

        it('should match start of word with *', () => {
            expect(classifySubTask('Automated Test', WILDCARD_GROUPS)).toBe('automation');
            expect(classifySubTask('Automation Suite', WILDCARD_GROUPS)).toBe('automation');
            expect(classifySubTask('Autoscale logic', WILDCARD_GROUPS)).toBe('automation');
        });

        it('should match end of word with * (treated as contains)', () => {
            // My implementation uses .includes() after stripping *, so it matches anywhere
            expect(classifySubTask('The dev-script', WILDCARD_GROUPS)).toBe('automation');
        });

        it('should match anywhere in string when using stripped wildcard logic', () => {
            expect(classifySubTask('SW embedded SW', WILDCARD_GROUPS)).toBe('embedded');
            expect(classifySubTask('EMBEDDED', WILDCARD_GROUPS)).toBe('embedded');
        });

        it('should not match if substring is missing', () => {
            expect(classifySubTask('Manual Test', WILDCARD_GROUPS)).toBe(OTHER_GROUP_ID);
        });
    });
});
