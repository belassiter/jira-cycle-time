import { IssueTimeline } from './transformers';

export interface SubTaskGroup {
    id: string;
    name: string;
    keywords: string[]; // Comma separated keywords
}

export const OTHER_GROUP_ID = 'other';
export const OTHER_GROUP_NAME = 'Other';

export function classifySubTask(summary: string, groups: SubTaskGroup[]): string {
    const summaryLower = summary.toLowerCase();
    
    for (const group of groups) {
        for (const keyword of group.keywords) {
             const kRaw = keyword.trim().toLowerCase();
             if (!kRaw) continue;

             // Check for wildcard '*'
             // If "embed*", we match "embedded". "embed" also matches "embedded".
             // We treat "embed*" as just "embed" for now given simple requirements.
             const k = kRaw.replace(/\*/g, '');
             
             if (k && summaryLower.includes(k)) {
                 return group.id;
             }
        }
    }
    
    return OTHER_GROUP_ID;
}

/**
 * Returns a map of GroupID -> List of Issues
 */
export function groupSubTasks(subTasks: IssueTimeline[], groups: SubTaskGroup[]): Record<string, IssueTimeline[]> {
    const result: Record<string, IssueTimeline[]> = {};
    
    // Initialize buckets
    groups.forEach(g => result[g.id] = []);
    result[OTHER_GROUP_ID] = [];

    subTasks.forEach(task => {
        const groupId = classifySubTask(task.summary, groups);
        if (result[groupId]) {
            result[groupId].push(task);
        } else {
             // Fallback
             if (!result[OTHER_GROUP_ID]) result[OTHER_GROUP_ID] = [];
             result[OTHER_GROUP_ID].push(task);
        }
    });

    return result;
}
