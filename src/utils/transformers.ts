import { parseISO, isAfter } from 'date-fns';
import { calculateCycleTime } from './cycleTime';

// Types
export interface StatusSegment {
  status: string;
  start: Date;
  end: Date;
  durationDays: number; // e.g. 1.5
}

export interface IssueTimeline {
  key: string;
  url?: string;
  summary: string;
  issueType?: string;
  issueTypeIconUrl?: string;
  segments: StatusSegment[];
  totalCycleTime: number; // Sum of relevant statuses
  depth: number; // Hierarchy depth (0 = Root)
  hasChildren: boolean;
  parentId?: string;
  subRows?: IssueTimeline[]; // For Tree Data tables
}

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#e9ecef',
  'Open': '#e9ecef',
  'Backlog': '#e9ecef',
  
  'In Progress': '#4dabf7',
  'In Development': '#4dabf7',
  'Implementing': '#4dabf7',
  
  'In Review': '#ffd43b',
  'Code Review': '#ffd43b',
  'Under Review': '#ffd43b',
  
  'In Testing': '#ff922b',
  'Testing': '#ff922b',
  'QA': '#ff922b',
  
  'Done': '#51cf66',
  'Closed': '#2f9e44',
  'Resolved': '#51cf66'
};

export const getStatusColor = (status: string) => {
  return STATUS_COLORS[status] || '#868e96'; // Gray for unknown
};

// ...
export function processIssueTimeline(issue: any): Omit<IssueTimeline, 'depth' | 'hasChildren'> {
    const created = typeof issue.created === 'string' ? parseISO(issue.created) : parseISO(issue.fields.created);
    // Backend now returns 'changelog' at root of object for search results, or inside fields for single issue.
    // Our updated backend normalization puts it at root.
    const history = issue.changelog?.histories || issue.fields?.changelog?.histories || [];
    const summary = typeof issue.summary === 'string' ? issue.summary : (issue.fields?.summary || 'No Summary');
    const issueType = issue.fields?.issuetype?.name || issue.issueType || 'Unknown';
  
  // 1. Extract all Status Changes

  // We need a flat list of changes: { date: Date, toStatus: string }
  const changes = history
    .flatMap((entry: any) => {
      const statusItem = entry.items.find((i: any) => i.field === 'status');
      if (!statusItem) return null;
      return {
        date: parseISO(entry.created),
        toStatus: typeof statusItem.toString === 'string' ? statusItem.toString.trim() : statusItem.toString,
        fromStatus: typeof statusItem.fromString === 'string' ? statusItem.fromString.trim() : statusItem.fromString
      };
    })
    .filter(Boolean)
    // Sort by date ascending (oldest first)
    .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

  // 2. Build Segments
  const segments: StatusSegment[] = [];
  
  // The initial status is tricky. Jira doesn't always explicitly say "Transitioned to To Do".
  // Usually the first transition 'fromString' tells us what the initial status was.
  // Or we assume 'To Do' / 'Open' if empty.
  let initialStatusRaw = 'Unknown';
  if (changes.length > 0) {
      initialStatusRaw = changes[0].fromStatus;
  } else {
     // Fallback to current status if no changes
     initialStatusRaw = typeof issue.status === 'string' ? issue.status : issue.fields?.status?.name || 'Unknown';
  }

  let currentStatus = initialStatusRaw.trim();
  let cursor = created;

  for (const change of changes) {
    // If the change happened AFTER the cursor, we have a segment
    if (isAfter(change.date, cursor)) {
      segments.push({
        status: currentStatus,
        start: cursor,
        end: change.date,
        durationDays: calculateCycleTime(cursor, change.date)
      });
    }
    // Update cursor and status
    currentStatus = change.toStatus;
    cursor = change.date;
  }

  // 3. Add final segment (from last change until Now)
  // Only if the issue is NOT in a "Done" state.
  // If it is Done, the cycle effectively ended at the last transition.
  // BUT for a Gannt chart, we want to see "Done" extending to now (or forever).
  // Let's cap "Done" at today for visualization purposes.
  // For the active duration, we calculate up to Now.
  segments.push({
    status: currentStatus,
    start: cursor,
    end: new Date(), // Visual cutoff
    durationDays: calculateCycleTime(cursor, new Date())
  });

  return {
    key: issue.key,
    url: issue.url,
    summary: summary, // Use local var
    issueType,
    issueTypeIconUrl: issue.issueTypeIconUrl,
    segments,
    totalCycleTime: segments.reduce((sum, s) => sum + s.durationDays, 0)
  };
}

/**
 * Filters out issues of specific types and ALL their descendants.
 */
export function filterTimelineByIssueType(
    allIssues: IssueTimeline[],
    excludedIssueTypes: string[],
    relationsMap: Map<string, string[]>
): IssueTimeline[] {
    if (excludedIssueTypes.length === 0) return allIssues;

    const issueTypeSet = new Set(excludedIssueTypes.map(s => s.toLowerCase()));
    
    // 1. Identify issues that match the excluded type
    const matchedIssueKeys = new Set<string>();
    allIssues.forEach(t => {
        if (t.issueType && issueTypeSet.has(t.issueType.toLowerCase())) {
            matchedIssueKeys.add(t.key);
        }
    });

    if (matchedIssueKeys.size === 0) return allIssues;

    // 2. Identify all descendants of these issues
    const keysToExclude = new Set<string>(matchedIssueKeys);
    const queue = Array.from(matchedIssueKeys);
    while(queue.length > 0) {
        const current = queue.shift()!;
        const children = relationsMap.get(current) || [];
        children.forEach(child => {
            if (!keysToExclude.has(child)) {
                keysToExclude.add(child);
                queue.push(child);
            }
        });
    }

    return allIssues.filter(t => !keysToExclude.has(t.key));
}

/**
 * Filter segments by status and return a new timeline array
 */
export function filterTimelineStatuses(timelines: IssueTimeline[], ignoreStatuses: string[]): IssueTimeline[] {
  const ignoreSet = new Set(ignoreStatuses.map(s => s.trim().toLowerCase()));
  
  return timelines.map(t => {
    const filteredSegments = t.segments.filter(s => !ignoreSet.has(s.status.trim().toLowerCase()));
    
    return {
      ...t,
      segments: filteredSegments,
      totalCycleTime: filteredSegments.reduce((sum, s) => sum + s.durationDays, 0)
    };
  });
}

export function processParentsAndChildren(flatIssues: any[]): IssueTimeline[] {
    // 1. Convert all raw issues to Timeline objects (without hierarchy info yet)
    const nodes = flatIssues.map(issue => {
        const base = processIssueTimeline(issue);
        return {
            ...base,
            parentKey: issue.parentKey, // Mapped by backend
            key: issue.key
        };
    });

    // 2. Build Tree Structure
    // Find the one node that might be the "Root" of this specific view?
    // Actually, JQL returns a forest.
    // If we used "issue in childIssuesOf(X)", X is the root.
    // But X might have a parent Y that is NOT in the list.
    // So any node whose parent is NOT in the 'nodes' list is effectively a Root.
    
    const nodeMap = new Map(nodes.map(n => [n.key, n]));
    const childrenMap = new Map<string, string[]>(); // ParentKey -> ChildKeys[]

    nodes.forEach(node => {
        if (node.parentKey && nodeMap.has(node.parentKey)) {
            const existing = childrenMap.get(node.parentKey) || [];
            existing.push(node.key);
            childrenMap.set(node.parentKey, existing);
        }
    });

    // 3. Find Roots (nodes with no parent in the dataset)
    const roots = nodes.filter(n => !n.parentKey || !nodeMap.has(n.parentKey));
    
    // 4. Flatten Tree (DFS)
    const flattened: IssueTimeline[] = [];
    
    function traverse(key: string, depth: number) {
        const node = nodeMap.get(key);
        if (!node) return;

        const childrenKeys = childrenMap.get(key) || [];
        
        // Push current node
        flattened.push({
            ...node,
            depth,
            hasChildren: childrenKeys.length > 0,
            parentId: node.parentKey
        } as IssueTimeline);

        // Sort children?
        // Let's sort simply by key for now to be deterministic, 
        // or by start date ideally but we need full objects for that.
        const childNodes = childrenKeys.map(k => nodeMap.get(k)!).filter(Boolean);
        // Optional: Sort childNodes by earliest segment start?
        // childNodes.sort((a, b) => ...); 
        
        childNodes.forEach(child => traverse(child.key, depth + 1));
    }

    roots.forEach(root => traverse(root.key, 0));
    
    return flattened;
}

export function buildIssueTree(flatIssues: IssueTimeline[]): IssueTimeline[] {
    console.log(`[buildIssueTree] Input: ${flatIssues.length} issues`);
    const itemMap = new Map<string, IssueTimeline>();
    const roots: IssueTimeline[] = [];

    // 1. Clone items to avoid mutating original flat list references if used elsewhere
    // and initialize subRows
    flatIssues.forEach(issue => {
        itemMap.set(issue.key, { ...issue, subRows: [] });
    });

    let matched = 0;
    let orphaned = 0;

    // 2. Build Tree
    itemMap.forEach(issue => {
        if (issue.parentId && itemMap.has(issue.parentId)) {
            const parent = itemMap.get(issue.parentId);
            if (parent) {
                parent.subRows = parent.subRows || [];
                parent.subRows.push(issue);
                matched++;
            }
        } else {
            roots.push(issue);
            if (issue.parentId) orphaned++;
        }
    });

    // Clean up empty subRows to avoid MRT confusion
    itemMap.forEach(issue => {
        if (issue.subRows && issue.subRows.length === 0) {
            delete issue.subRows;
        }
    });

    console.log(`[buildIssueTree] Roots: ${roots.length}, Matched Children: ${matched}, Orphans (parentId set but parent missing): ${orphaned}`);
    
    // Sort roots and children
    roots.forEach(sortRecursively);
    return sortIssueTimelines(roots); // Sort roots themselves
}

function sortRecursively(node: IssueTimeline) {
    if (node.subRows && node.subRows.length > 0) {
        node.subRows = sortIssueTimelines(node.subRows);
        node.subRows.forEach(sortRecursively);
    }
}


/**
 * Sorts timelines:
 * 1. Items with data: sorted by earliest start date
 * 2. Items without data: sorted by key (alphabetical)
 */
export function sortIssueTimelines(timelines: IssueTimeline[]): IssueTimeline[] {
  if (timelines.length === 0) return [];
  
  const withData = timelines.filter(c => c.segments.length > 0);
  const withoutData = timelines.filter(c => c.segments.length === 0);
  
  withData.sort((a, b) => {
    const startA = a.segments[0].start.getTime(); // Segments are already sorted by date in processIssueTimeline
    const startB = b.segments[0].start.getTime();
    return startA - startB;
  });
  
  withoutData.sort((a, b) => a.key.localeCompare(b.key));
  
  return [...withData, ...withoutData];
}

