import { differenceInDays } from 'date-fns';
import { IssueTimeline } from './transformers';
import { MRT_RowSelectionState } from 'mantine-react-table';
import { calculateCycleTime } from './cycleTime';
import { SubTaskGroup, groupSubTasks, OTHER_GROUP_ID, OTHER_GROUP_NAME } from './grouping';

export interface GroupStatistic {
    groupId: string;
    groupName: string;
    average: number;
    stdDev: number;
    count: number;
    tooltip: string; // "X ± Y work days"
}

export interface SelectedIssueStats {
    key: string;
    summary: string;
    
    // Header Stats
    totalCycleTime: number;
    totalCalendarWeeks: number;

    rootSummary: string | null; // Null if multiple roots or single root is selected
    
    // Tier Stats
    epicStats: TierStats | null;
    storyStats: TierStats | null; // Includes Story, Task, Bug, etc.
    
    // Existing Complex Sub-task Grouping
    subTaskStats?: {
        groups: GroupStatistic[];
        longestGroup: GroupStatistic | null;
        lastGroup: GroupStatistic | null;
        globalAverage: string; // X ± Y work days
    };
}

export interface TierStats {
    count: number;
    average: string | null;
    longest: { key: string; summary: string; val: string; url?: string } | null;
    last: { key: string; summary: string; val: string; url?: string } | null;
    distribution: TierDistributionItem[]; // For plotting
}

export interface TierDistributionItem {
    id: string;
    key: string;
    summary: string;
    value: number;
    category: string; // e.g. "Story", "Bug" for Story tier; "Epic" for Epic tier
    url?: string;
}


export function formatMetric(val: number): string {
    if (val >= 10) {
        return Math.round(val).toString();
    }
    return parseFloat(val.toFixed(1)).toString();
}

function calculateMeanStdDev(values: number[]): { mean: number; stdDev: number; str: string } {
    if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        
        let variance = 0;
        if (values.length > 1) {
             const sumSqDiff = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
             variance = sumSqDiff / (values.length - 1);
        }
        const stdDev = Math.sqrt(variance);
        
        const meanStr = formatMetric(mean); 
        let stdDevStr = '';
        if (mean >= 10) {
            stdDevStr = Math.round(stdDev).toString();
        } else {
            stdDevStr = parseFloat(stdDev.toFixed(1)).toString();
        }
        return { mean, stdDev, str: `${meanStr} ± ${stdDevStr} work days` };
    }
    return { mean: 0, stdDev: 0, str: '' };
}

export function calculateIssueStats(
    rowSelection: MRT_RowSelectionState,
    timelineData: IssueTimeline[] | null,
    _relationsMap?: Map<string, string[]>, 
    subTaskGroups: SubTaskGroup[] = []
): SelectedIssueStats | null {
    const selectedKeys = Object.keys(rowSelection).filter(k => rowSelection[k]);
    if (selectedKeys.length === 0 || !timelineData) return null;
    
    // In multi-selection mode, we select an "Anchor" (the first one) 
    // but filter all participants based on the selection state.
    const anchorId = selectedKeys[0];
    const anchorIssue = timelineData.find(t => t.key === anchorId);
    if (!anchorIssue) return null;

    // Participants are only those explicitly selected
    const participantKeys = new Set(selectedKeys);
    const participants = timelineData.filter(t => participantKeys.has(t.key));

    const getEndDate = (issue: IssueTimeline) => {
        if (!issue.segments || issue.segments.length === 0) return 0;
        return issue.segments[issue.segments.length - 1].end.getTime();
    };

    // 1. Global Cycle Time (Span of all SELECTed issues)
    const family = participants;
    let globalMinStart: Date | null = null;
    let globalMaxEnd: Date | null = null;

    family.forEach(issue => {
        issue.segments.forEach(seg => {
            if (!globalMinStart || seg.start < globalMinStart) globalMinStart = seg.start;
            if (!globalMaxEnd || seg.end > globalMaxEnd) globalMaxEnd = seg.end;
        });
    });

    const cycleTime = (globalMinStart && globalMaxEnd) 
        ? calculateCycleTime(globalMinStart, globalMaxEnd)
        : 0;

    // 2. Calendar Time
    let calendarDays = 0;
    if (globalMinStart && globalMaxEnd) {
        calendarDays = differenceInDays(globalMaxEnd, globalMinStart);
    }
    const calendarWeeks = Number((calendarDays / 7).toFixed(1));

    // 3. Root Summary Logic ("Highest Level")
    // Find depth of all participants
    // Assuming 'depth' property exists on IssueTimeline (and is correct relative to view)
    // If not, we might need to rely on 'parentId' logic. But 'depth' is pre-calculated.
    let rootSummary: string | null = null;
    if (participants.length > 0) {
        const minDepth = Math.min(...participants.map(p => p.depth));
        const roots = participants.filter(p => p.depth === minDepth);
        if (roots.length === 1) {
            rootSummary = roots[0].summary;
        }
    }

    const tierStats = (issues: IssueTimeline[], categoryFn: (i: IssueTimeline) => string): TierStats | null => {
        if (issues.length === 0) return null;
        
        const times = issues.map(i => i.totalCycleTime).filter(t => t > 0);
        if (times.length === 0) return null;

        const { str } = calculateMeanStdDev(times);
        
        const longestRaw = issues.reduce((prev, curr) => (prev.totalCycleTime > curr.totalCycleTime) ? prev : curr);
        const lastRaw = issues.reduce((prev, curr) => (getEndDate(prev) > getEndDate(curr)) ? prev : curr);

        // Build Distribution
        const distribution: TierDistributionItem[] = issues.map(i => ({
            id: i.key,
            key: i.key,
            summary: i.summary,
            value: i.totalCycleTime,
            category: categoryFn(i),
            url: i.url
        }));

        return {
            count: issues.length,
            average: str,
            longest: { key: longestRaw.key, summary: longestRaw.summary, val: formatMetric(longestRaw.totalCycleTime), url: longestRaw.url },
            last: { key: lastRaw.key, summary: lastRaw.summary, val: formatMetric(lastRaw.totalCycleTime), url: lastRaw.url },
            distribution
        };
    };

    const isEpic = (t: IssueTimeline) => t.issueType === 'Epic' || t.issueType === 'Feature' || t.issueType === 'Initiative';
    const isSubtask = (t: IssueTimeline) => t.issueType === 'Sub-task';
    const isStandard = (t: IssueTimeline) => !isEpic(t) && !isSubtask(t);

    const epics = participants.filter(isEpic);
    const stories = participants.filter(isStandard);
    
    // Base stats
    const stats: SelectedIssueStats = {
        key: participantKeys.size > 1 ? `${participantKeys.size} Items` : anchorIssue.key,
        summary: participantKeys.size > 1 ? 'Multiple items selected' : anchorIssue.summary,
        
        totalCycleTime: cycleTime,
        totalCalendarWeeks: calendarWeeks,
        rootSummary,
        
        epicStats: tierStats(epics, (i) => i.issueType || 'Epic'),
        storyStats: tierStats(stories, (i) => i.issueType || 'Story'),
    };


    // --- Sub-task Grouping Statistics (Only if Sub-tasks explicitly selected) ---
    const allSelectedSubTasks = participants.filter(d => d.issueType === 'Sub-task');

    if (allSelectedSubTasks.length > 0) {
        const grouped = groupSubTasks(allSelectedSubTasks, subTaskGroups);
        const groupStats: GroupStatistic[] = [];
        const allGroups = [...subTaskGroups, { id: OTHER_GROUP_ID, name: OTHER_GROUP_NAME, keywords: [] }];

        allGroups.forEach(g => {
            const tasks = grouped[g.id] || [];
            const times = tasks.map(t => t.totalCycleTime).filter(t => t > 0);
            
            if (times.length > 0) {
                const { mean, stdDev, str } = calculateMeanStdDev(times);
                groupStats.push({
                    groupId: g.id,
                    groupName: g.name,
                    average: mean,
                    stdDev: stdDev,
                    count: tasks.length,
                    tooltip: str
                });
            }
        });

        if (groupStats.length > 0) {
            const allTimes = allSelectedSubTasks.map(t => t.totalCycleTime).filter(t => t > 0);
            const longestGroup = groupStats.reduce((prev, curr) => (prev.average > curr.average) ? prev : curr);
            
            // Last Group Logic
            const parentMap = new Map<string, IssueTimeline[]>();
            allSelectedSubTasks.forEach(st => {
                if (st.parentId) {
                    if (!parentMap.has(st.parentId)) parentMap.set(st.parentId, []);
                    parentMap.get(st.parentId)?.push(st);
                }
            });

            const lastCounts: Record<string, number> = {}; 
            parentMap.forEach((siblings) => {
                const lastSibling = siblings.reduce((prev, curr) => (getEndDate(prev) > getEndDate(curr) ? prev : curr), siblings[0]);
                if (getEndDate(lastSibling) > 0) {
                    const matchGroup = allGroups.find(g => grouped[g.id]?.includes(lastSibling));
                    const groupId = matchGroup ? matchGroup.id : OTHER_GROUP_ID;
                    lastCounts[groupId] = (lastCounts[groupId] || 0) + 1;
                }
            });
            
            let lastGroup: GroupStatistic | null = null;
            let maxCount = -1;
            
            Object.keys(lastCounts).forEach(gid => {
                if (lastCounts[gid] > maxCount) {
                    maxCount = lastCounts[gid];
                    lastGroup = groupStats.find(g => g.groupId === gid) || null;
                }
            });
            
            const { str: globalAvg } = calculateMeanStdDev(allTimes);

            stats.subTaskStats = {
                groups: groupStats,
                longestGroup: longestGroup,
                lastGroup: lastGroup,
                globalAverage: globalAvg
            };
        }
    }

    return stats;
}


// Removed unused getAllDescendantsRecursive
