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
    cycleTime: number;
    calendarWeeks: number;
    average: string | null;
    childLevel: string;
    longestSubtask: { key: string; summary: string; val: string } | null;
    lastSubtask: { key: string; summary: string; val: string } | null;
    
    // New Fields for Sub-task Grouping
    subTaskStats?: {
        groups: GroupStatistic[];
        longestGroup: GroupStatistic | null;
        lastGroup: GroupStatistic | null;
        globalAverage: string; // X ± Y work days
    };
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

/**
 * Optimized descendant retrieval using an Adjacency Map.
 * O(Descendants) complexity instead of O(Total * Descendants)
 */
function getAllDescendantsFast(rootId: string, relationsMap: Map<string, string[]>, allIssuesMap: Map<string, IssueTimeline>): IssueTimeline[] {
    const results: IssueTimeline[] = [];
    const queue = [rootId];
    
    while(queue.length > 0) {
        const currentId = queue.shift()!;
        const childrenKeys = relationsMap.get(currentId) || [];
        
        childrenKeys.forEach(childKey => {
            const childNode = allIssuesMap.get(childKey);
            if (childNode) {
                results.push(childNode);
                queue.push(childKey); // Continue BFS
            }
        });
    }
    return results;
}

export function calculateIssueStats(
    rowSelection: MRT_RowSelectionState,
    timelineData: IssueTimeline[] | null,
    relationsMap?: Map<string, string[]>, 
    subTaskGroups: SubTaskGroup[] = []
): SelectedIssueStats | null {
    const selectedKeys = Object.keys(rowSelection);
    if (selectedKeys.length === 0 || !timelineData) return null;
    
    // In single selection mode, use the first key
    const selectedId = selectedKeys.find(k => rowSelection[k] === true);
    if (!selectedId) return null;

    const selectedIssue = timelineData.find(t => t.key === selectedId);
    if (!selectedIssue) return null;
    if (!selectedIssue.hasChildren) return null;

    // Use fast lookup if map is provided
    let descendants: IssueTimeline[] = [];
    const issueMap = relationsMap ? new Map(timelineData.map(i => [i.key, i])) : new Map();

    if (relationsMap) {
        descendants = getAllDescendantsFast(selectedId, relationsMap, issueMap);
    } else {
        descendants = getAllDescendantsRecursive(selectedId, timelineData);
    }


    // 1. Global Cycle Time (Selected + All Descendants)
    // Span from earliest start to last end
    const family = [selectedIssue, ...descendants];
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

    // 2. Calendar Time (First segment start to Last segment end) -> Weeks
    // Let's use the Global Range for consistency, as that represents the "Project/Epic Duration".
    let calendarDays = 0;
    if (globalMinStart && globalMaxEnd) {
        calendarDays = differenceInDays(globalMaxEnd, globalMinStart);
    }
    const calendarWeeks = Number((calendarDays / 7).toFixed(1));

    // Stats based on One Level Down (Direct Children)
    const children = timelineData.filter(t => t.parentId === selectedId);
    const childLevel = (selectedIssue.issueType === 'Epic' || selectedIssue.issueType === 'Feature') ? 'Story/Task' : 'Sub-task';

    if (children.length === 0) {
        return {
            key: selectedIssue.key,
            summary: selectedIssue.summary,
            cycleTime,
            calendarWeeks,
            average: null,
            childLevel,
            longestSubtask: null,
            lastSubtask: null
        };
    }

    // 3. Average & StdDev
    const validCycleTimes = children
        .map(c => c.totalCycleTime)
        .filter(val => val > 0); // Ignore zero

    let averageStr: string | null = null;
    if (validCycleTimes.length > 0) {
        averageStr = calculateMeanStdDev(validCycleTimes).str;
    }

    // 4. Longest Sub-task (One Level Down)
    const longestSubtaskRaw = children.reduce((prev, current) => {
        return (prev.totalCycleTime > current.totalCycleTime) ? prev : current;
    });

    // 5. Last Sub-task (Latest End Date) relative to Direct Children
    const getEndDate = (issue: IssueTimeline) => {
        if (!issue.segments || issue.segments.length === 0) return 0;
        return issue.segments[issue.segments.length - 1].end.getTime();
    };

    const lastSubtaskRaw = children.reduce((prev, current) => {
        return (getEndDate(prev) > getEndDate(current)) ? prev : current;
    });

    // --- Sub-task Grouping Statistics (Only if Epic selected) ---
    let subTaskStats: SelectedIssueStats['subTaskStats'] | undefined;

    // Ensure we are selecting an Epic or Feature to run this deeper analysis
    if (selectedIssue.issueType === 'Epic' || selectedIssue.issueType === 'Feature') {
        const allSubTasks = descendants.filter(d => d.issueType === 'Sub-task');

        if (allSubTasks.length > 0) {
            // Group them
            const grouped = groupSubTasks(allSubTasks, subTaskGroups);
            const groupStats: GroupStatistic[] = [];

            // Iterate Configured groups first
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
                        count: times.length,
                        tooltip: str
                    });
                }
            });

            const allTimes = allSubTasks.map(t => t.totalCycleTime).filter(t => t > 0);
            const globalStats = calculateMeanStdDev(allTimes);

            let longestGroup: GroupStatistic | null = null;
            if (groupStats.length > 0) {
                longestGroup = groupStats.reduce((prev, curr) => (prev.average > curr.average) ? prev : curr);
            }

            // Last Group Logic
            const parentMap = new Map<string, IssueTimeline[]>();
            allSubTasks.forEach(st => {
                if (st.parentId) {
                    if (!parentMap.has(st.parentId)) parentMap.set(st.parentId, []);
                    parentMap.get(st.parentId)?.push(st);
                }
            });

            const lastCounts: Record<string, number> = {}; 
            
            parentMap.forEach((siblings) => {
                // Find sibling with max end date
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
                    const stat = groupStats.find(gs => gs.groupId === gid);
                    if (stat) lastGroup = stat;
                }
            });
            
            // Only populate if we have valid groups calculated
            if (groupStats.length > 0) {
                subTaskStats = {
                    groups: groupStats,
                    globalAverage: globalStats.str,
                    longestGroup,
                    lastGroup
                };
            }
        }
    }

    return {
         key: selectedIssue.key,
         summary: selectedIssue.summary,
         cycleTime,
         calendarWeeks,
         average: averageStr,
         childLevel,
         longestSubtask: {
             key: longestSubtaskRaw.key,
             summary: longestSubtaskRaw.summary,
             val: formatMetric(longestSubtaskRaw.totalCycleTime)
         },
         lastSubtask: {
             key: lastSubtaskRaw.key,
             summary: lastSubtaskRaw.summary,
             val: formatMetric(lastSubtaskRaw.totalCycleTime)
         },
         subTaskStats
    };
}

function getAllDescendantsRecursive(rootId: string, allIssues: IssueTimeline[]): IssueTimeline[] {
    const children = allIssues.filter(i => i.parentId === rootId);
    let descendants = [...children];
    children.forEach(child => {
        descendants = descendants.concat(getAllDescendantsRecursive(child.key, allIssues));
    });
    return descendants;
}
