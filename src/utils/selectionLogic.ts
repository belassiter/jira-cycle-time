// src/utils/selectionLogic.ts
import { type MRT_RowSelectionState, type MRT_Updater } from 'mantine-react-table';

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
