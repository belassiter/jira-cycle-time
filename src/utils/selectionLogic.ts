// src/utils/selectionLogic.ts
import { type MRT_RowSelectionState, type MRT_Updater } from 'mantine-react-table';

/**
 * Updates selection to include/exclude all descendants of the primary target.
 * Returns a new MRT_RowSelectionState.
 */
export const handleToggleWithDescendants = (
    updater: MRT_Updater<MRT_RowSelectionState>,
    currentSelection: MRT_RowSelectionState,
    relationsMap: Map<string, string[]>
): MRT_RowSelectionState => {
    const nextSelection = typeof updater === 'function' ? updater(currentSelection) : updater;

    const oldKeysSet = new Set(Object.keys(currentSelection).filter(k => currentSelection[k]));
    const newKeysSet = new Set(Object.keys(nextSelection).filter(k => nextSelection[k]));

    // Find what changed (Performance optimized: O(N) using Sets)
    const added: string[] = [];
    newKeysSet.forEach(k => {
        if (!oldKeysSet.has(k)) added.push(k);
    });

    const removed: string[] = [];
    oldKeysSet.forEach(k => {
        if (!newKeysSet.has(k)) removed.push(k);
    });

    const result = { ...nextSelection };

    // Function to recursively get all children
    const getDeepChildren = (id: string, acc: string[] = []) => {
        const children = relationsMap.get(id) || [];
        children.forEach(c => {
            acc.push(c);
            getDeepChildren(c, acc);
        });
        return acc;
    };

    if (added.length > 0) {
        added.forEach(id => {
            const children = getDeepChildren(id);
            children.forEach(c => { result[c] = true; });
        });
    }

    if (removed.length > 0) {
        removed.forEach(id => {
            const children = getDeepChildren(id);
            children.forEach(c => { delete result[c]; });
        });
    }

    return result;
};

export const handleSingleSelectionChange = (
  updater: MRT_Updater<MRT_RowSelectionState>,
  currentSelection: MRT_RowSelectionState
): MRT_RowSelectionState => {
  // Resolve the new selection from the updater
  const nextSelection =
    typeof updater === 'function' ? updater(currentSelection) : updater;

  const keys = Object.keys(nextSelection);

  // If nothing selected, return empty
  if (keys.length === 0) return {};

  // If multiple items are selected (e.g. user clicked a second checkbox)
  // We generally want to favor the *newly* selected one.
  // However, MRT doesn't give us "what changed", just the "result".
  // In a typical "click to select" scenario with checkboxes:
  // Old: { A: true }
  // Click B -> New: { A: true, B: true }
  // We want: { B: true }
  
  // If we assume the user clicked one thing, the 'difference' is the new one.
  const oldKeys = Object.keys(currentSelection);
  const newKey = keys.find(k => !oldKeys.includes(k));

  if (newKey) {
      return { [newKey]: true };
  }

  // If no *new* key was found (maybe a deselection happened),
  // e.g. Old: { A: true } -> Click A -> New: {} (handled above)
  
  // Edge case: Multiple keys provided at once (bulk select)?
  // We just take the last one to enforce single selection.
  const lastKey = keys[keys.length - 1];
  return { [lastKey]: true };
};
