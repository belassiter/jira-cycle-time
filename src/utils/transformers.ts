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
  summary: string;
  segments: StatusSegment[];
  totalCycleTime: number; // Sum of relevant statuses
}

// Config
// const HOLIDAYS = new Set(holidaysRaw); // 'YYYY-MM-DD'
// You might want to let the user configure which statuses count as "Cycle Time"
// For now, we count everything except 'To Do' and 'Done' maybe?
// Actually simpler: Just visualize everything first.

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

/**
 * Parses the raw Jira Changelog into a continuous timeline of statuses
 */
export function processIssueTimeline(issue: any): IssueTimeline {
  const created = parseISO(issue.fields.created);
  const history = issue.changelog?.histories || [];
  
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
  let currentStatus = changes.length > 0 ? changes[0].fromStatus : issue.fields.status.name.trim();
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
    summary: issue.fields.summary,
    segments,
    totalCycleTime: segments.reduce((sum, s) => sum + s.durationDays, 0)
  };
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

export function processParentsAndChildren(rawData: { parent: any, children: any[] }): IssueTimeline[] {
  const parentTimeline = processIssueTimeline(rawData.parent);
  const childrenTimelines = rawData.children.map(processIssueTimeline);
  
  // Return Parent first, then children
  return [parentTimeline, ...childrenTimelines];
}

/**
 * Sorts timelines according to business rules:
 * 1. Parent first (assumed index 0)
 * 2. Children with data: sorted by earliest start date
 * 3. Children without data: sorted by key (alphabetical)
 */
export function sortIssueTimelines(timelines: IssueTimeline[]): IssueTimeline[] {
  if (timelines.length === 0) return [];
  
  const parent = timelines[0];
  const children = timelines.slice(1);
  
  const withData = children.filter(c => c.segments.length > 0);
  const withoutData = children.filter(c => c.segments.length === 0);
  
  withData.sort((a, b) => {
    const startA = a.segments[0].start.getTime(); // Segments are already sorted by date in processIssueTimeline
    const startB = b.segments[0].start.getTime();
    return startA - startB;
  });
  
  withoutData.sort((a, b) => a.key.localeCompare(b.key));
  
  return [parent, ...withData, ...withoutData];
}

