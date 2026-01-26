import { differenceInDays } from 'date-fns';
import { IssueTimeline } from './transformers';
import { MRT_RowSelectionState } from 'mantine-react-table';
import { calculateCycleTime } from './cycleTime';

export interface SelectedIssueStats {
    key: string;
    summary: string;
    cycleTime: number;
    calendarWeeks: number;
    average: string | null;
    childLevel: string;
    longestSubtask: { key: string; summary: string; val: string } | null;
    lastSubtask: { key: string; summary: string; val: string } | null;
}

export function formatMetric(val: number): string {
    if (val >= 10) {
        return Math.round(val).toString();
    }
    return parseFloat(val.toFixed(1)).toString();
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
    relationsMap?: Map<string, string[]> // Optional for backward compatibility, but highly recommended
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
    
    if (relationsMap) {
        // We also need a fast lookup for issue objects to avoid .find()
        // We can build a temporary one or expect it passed. 
        // For now, building a map of current timelineData is O(N), 
        // and we only do it once per calculation.
        // Even better: The caller (App.tsx) should probably provide the lookup map too?
        // Let's keep it simple: build the Issue Lookup Map inside here for now 
        // or just accept O(N) map building since N=194 is tiny for V8. 
        // 194 items is nothing. The slowness came from recursion on filtering.
        
        const issueMap = new Map(timelineData.map(i => [i.key, i]));
        descendants = getAllDescendantsFast(selectedId, relationsMap, issueMap);
    } else {
        // Fallback to slow recursive filters
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
    // Re-using global range? "Calendar time should specify weeks". 
    // Assuming this also follows the "family" scope or keeps original?
    // User said "Cycle time is always based on the selected item... hierarchy chain".
    // Didn't explicitly change Calendar Time scope, but "Calendar Time" usually pairs with Cycle Time.
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
        const sum = validCycleTimes.reduce((a, b) => a + b, 0);
        const mean = sum / validCycleTimes.length;
        
        let variance = 0;
        if (validCycleTimes.length > 1) {
             const sumSqDiff = validCycleTimes.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
             variance = sumSqDiff / (validCycleTimes.length - 1); // Sample StdDev
        }
        const stdDev = Math.sqrt(variance);
        
        // "StdDev should use the same precision as the averaged value"
        // If Mean >= 10, both have 0 decimals. If Mean < 10, both have 1 decimal (or as formatMetric logic dictates).
        // formatMetric logic: val >= 10 ? round(val) : val.toFixed(1)
        
        const meanStr = formatMetric(mean); 
        let stdDevStr = '';
        
        // Determine precision based on MEAN, not StdDev value.
        if (mean >= 10) {
            stdDevStr = Math.round(stdDev).toString();
        } else {
             // Mean is < 10, so it uses 1 decimal place logic. StdDev should also use 1 decimal place.
             // Careful with round vs toFixed. formatMetric uses parseFloat(toFixed(1)) for < 10.
            stdDevStr = parseFloat(stdDev.toFixed(1)).toString();
        }
        
        averageStr = `${meanStr} ± ${stdDevStr} work days`;
    }

    // 4. Longest Sub-task (One Level Down)
    const longestSubtaskRaw = children.reduce((prev, current) => {
        return (prev.totalCycleTime > current.totalCycleTime) ? prev : current;
    });

    // 5. Last Sub-task (Latest End Date) relative to Direct Children
    const lastSubtaskRaw = children.reduce((prev, current) => {
        const getEndDate = (issue: IssueTimeline) => {
            if (issue.segments.length === 0) return 0;
            return issue.segments[issue.segments.length - 1].end.getTime();
        };
        return (getEndDate(prev) > getEndDate(current)) ? prev : current;
    });

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
             val: formatMetric(longestSubtaskRaw.totalCycleTime) + ' work days'
         },
         lastSubtask: {
             key: lastSubtaskRaw.key,
             summary: lastSubtaskRaw.summary,
             val: formatMetric(lastSubtaskRaw.totalCycleTime) + ' work days'
         }
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
