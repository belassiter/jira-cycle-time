import { IssueTimeline } from './transformers';

export const buildAdjacencyMap = (flatData: IssueTimeline[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    flatData.forEach(item => {
        if (item.parentId) {
            if (!map.has(item.parentId)) {
                map.set(item.parentId, []);
            }
            map.get(item.parentId)?.push(item.key);
        }
    });
    return map;
};

export const extractAllKeys = (nodes: IssueTimeline[]): Record<string, boolean> => {
  const acc: Record<string, boolean> = {};
  const traverse = (list: IssueTimeline[]) => {
    list.forEach(node => {
      acc[node.key] = true;
      if (node.subRows && node.subRows.length > 0) traverse(node.subRows);
    });
  };
  traverse(nodes);
  return acc;
};

export const calculateNextExpanded = (
    currentExpanded: boolean | Record<string, boolean>,
    treeData: IssueTimeline[],
    areSubtasksVisible: boolean
): { nextExpanded: Record<string, boolean>; nextAreSubtasksVisible: boolean } => {
    
    let nextExpanded: Record<string, boolean> = {};

    if (currentExpanded === true) {
       nextExpanded = extractAllKeys(treeData);
    } else {
       // Should ensure we're processing an object, not false (though MRT false = {})
       if (typeof currentExpanded === 'object' && currentExpanded !== null) {
         nextExpanded = { ...currentExpanded };
       }
    }

    const traverse = (nodes: IssueTimeline[]) => {
       nodes.forEach(node => {
           // Target specific issue types that usually contain sub-tasks
           // Or generalized: any node that has children but is NOT an Epic?
           // User requested "Sub-tasks" visibility, so we toggle their Parents.
           const isParentType = ['Story', 'Task', 'Bug', 'Improvement', 'Spike'].includes(node.issueType || '') || (node.issueType !== 'Epic' && node.issueType !== 'Feature');
           
           if (isParentType && node.hasChildren) {
              nextExpanded[node.key] = !areSubtasksVisible;
           }
           if (node.subRows) traverse(node.subRows);
       });
    };
    traverse(treeData);

    return {
        nextExpanded,
        nextAreSubtasksVisible: !areSubtasksVisible
    };
};
