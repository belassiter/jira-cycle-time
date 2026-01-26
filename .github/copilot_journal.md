# Copilot Journal

## 2024-05-24 09:50
- Implemented **Statistics Sidebar** feature to display Cycle Time, Calendar Time, and Subtask analysis for the selected issue.
- Extracted statistics logic to `src/utils/stats.ts` and added comprehensive unit tests in `src/utils/stats.test.ts`.
- Addressed a UI bug where the radio button for row selection was not checking visually despite state updates.
- Implemented a robust "Single Selection" logic using Checkboxes (`enableMultiRowSelection: true`) but enforcing a single active selection in `src/utils/selectionLogic.ts`.
- Verified the selection logic with new unit tests in `src/utils/selectionLogic.test.ts`.
- Refactored `App.tsx` and `IssueTreeTable.tsx` to integrate the new selection behavior and statistics display.
- Verified all changes with `npm run verify` (Lint: Pass, Test: Pass, Build: Pass).

## 2024-05-24 10:00
- Refined **Statistics Sidebar** metrics and presentation based on user feedback.
- Updated `src/utils/stats.ts` to calculate Calendar Time in "Weeks" and include Sub-task summaries.
- Verified logic with new tests in `src/utils/stats_refined.test.ts` and updated `src/utils/stats.test.ts`.
- Updated `src/App.tsx` to display Cycle Time in "work days", Calendar Time in "weeks", and Sub-tasks with truncated summaries and tooltips.
- Updated `src/components/IssueTreeTable.tsx` to fix Caret direction (Right=Collapsed, Down=Expanded) and added Light Blue background for selected rows.
- Verified all changes with `npm run verify`.

## 2024-05-24 10:30
- Advanced Statistics Implementation:
    - **Global Cycle Time**: Now calculates the total duration based on the earliest start and latest end of the selected item AND all its descendants, returning "work days".
    - **Scoped Metrics**: Longest/Last stats now target exactly "one level down" (e.g., Epic → Story, Story → Sub-task).
    - **New Metric**: Added "Average" cycle time (Average ± StdDev), ignoring zero values.
    - **Precision**: Enforced strict decimal rules (Max 1 decimal, 0 decimals if >= 10).
- Rewrote `src/utils/stats.ts` to support recursive descendant traversal and advanced math.
- Consolidated and updated tests into `src/utils/stats.test.ts` (formerly stats_advanced).
- Updated `src/App.tsx` to dynamically render "Story/Task" or "Sub-task" headers and display the new Average metric.
- Verified all changes with `npm run verify` (Lint: Pass, Test: Pass, Build: Pass).

## 2024-05-24 10:45
- Backfilled `src/data/holidays.json` with 2023 and 2024 holiday dates (MLK, President's Day, Memorial, Juneteenth, Independence, Labor, Thanksgiving (2d), Xmas Eve/Day, New Year's).
- Refined Statistics Formatting:
    - **StdDev Precision**: Now explicitly matches the precision of the specific Average (Mean) value it is paired with.
    - **Alignment**: Right-justified the Average statistic in the Sidebar.
- UI Cleanup:
    - Disabled column sorting in `IssueTreeTable.tsx`.
    - Ensured font consistency for statistics in `App.tsx`.
- Verified all changes with `npm run verify`.
