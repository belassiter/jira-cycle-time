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
});
