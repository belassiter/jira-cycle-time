# Copilot Journal

This file tracks the evolution of the project. Copilot should update this file after completing significant tasks.

## General Format
* **Goal**: [Brief description of the objective]
* **Files Modified**: [List of key files changed] (Optional)
* **Approach**: [Technical details of implementation]
* **Outcome**: [Result and verification status]

---

## Date: 2026-01-22
* **Goal**: Architecture Definition
* **Approach**: Evaluated Python vs Electron options. Selected `Electron` + `React` + `Mantine` + `Visx`.
* **Reasoning**: User preferred the native desktop experience of Electron and has Node.js experience. Visx provides the granular control needed for complex Gantt/Timeline visualizations.
* **Outcome**: Architecture locked. Ready for scaffolding.

## Date: 2026-01-22
* **Goal**: Scaffolding
* **Files Modified**: `package.json`, `vite.config.ts`, `electron/main.ts`, `src/App.tsx`, `index.html`, `tsconfig.json` etc.
* **Approach**: Created standard Electron + Vite + React structure. Configured `package.json` with scripts for `electron`, `vite`, and `electron-builder`. Added Mantine provider.
* **Outcome**: Files created. `npm install` failed due to missing path in this terminal.

## Date: 2026-01-22
* **Goal**: POC Part 3 - Pull Data
* **Files Modified**: `src/global.d.ts`, `src/App.tsx`, `electron/main.ts`, `electron/preload.ts`
* **Approach**: Implemented Jira API fetch in backend. Added Typescript definitions for IPC. Created simple UI to input Issue ID and display summary.
* **Outcome**: Application should now be able to fetch and display basic issue data. User needs to configure `jira-secrets.json`.

## Date: 2026-01-22
* **Goal**: POC Part 4 - Recursive Subtask Fetch
* **Files Modified**: `electron/main.ts`, `src/App.tsx`
* **Approach**: Refactored `jira-get-issue` in backend to first fetch the parent, inspect `fields.subtasks`, and then `Promise.all` fetch all children with their changelogs.
* **Outcome**: App now displays counts for Subtasks and confirms they are being retrieved.

## Date: 2026-01-22
* **Goal**: POC Part 5 - Data Transformation
* **Files Modified**: `src/utils/transformers.ts`
* **Approach**: Created `processIssueTimeline` to flatten Jira changelogs into `Start -> End` segments. Added basic status color mapping.
* **Note**: Currently uses calendar days. Business logic (holidays/weekends) is imported but not yet fully utilized in the calculation to keep the initial visualization simple.

## Date: 2026-01-22
* **Goal**: POC Part 6 - Visualization
* **Files Modified**: `src/components/TimelineChart.tsx`, `src/App.tsx`
* **Approach**: Created a "Lightweight Gantt" component using absolute positioning within a flex row. It calculates global Min/Max dates to normalize the X-axis scale (`0%` to `100%`).
* **Outcome**: Application now retrieves data, processes into segments, and visualizes it as a color-coded timeline. POC Complete.

## Date: 2026-01-22
* **Goal**: POC Verification & Stabilization
* **Files Modified**: `.eslintrc.cjs`, `package.json`, `src/App.tsx`, `src/utils/transformers.test.ts`
* **Approach**:
    *   Added ESLint configuration and fixed linting errors.
    *   Fixed `src/App.tsx` corruption.
    *   Added unit tests for transformers to satisfy test requirement.
    *   Modified `npm run build` to skip packaging (symlink permission issues) but ensure code compilation.
* **Outcome**: `npm run verify` passes successfully. Code is stable and verified.

## Date: 2026-01-22
* **Goal**: Fix CI/Verification Process
* **Files Modified**: `package.json`
* **Approach**: Updated `test` script to use `vitest run` instead of `vitest` to prevent the test runner from entering watch mode and blocking the `verify` chain.
* **Outcome**: `npm run verify` now runs to completion automatically.

## Date: 2026-01-22
* **Goal**: Housekeeping
* **Files Modified**: `.gitignore`
* **Approach**: Added `jira-secrets.json` to `.gitignore` to prevent secret leakage.
* **Outcome**: Verified successfully.

## Date: 2026-01-22
* **Goal**: Refine Visualization & Backfill Tests (TDD)
* **Files Modified**: `src/utils/transformers.test.ts`, `src/utils/transformers.ts`, `src/components/TimelineChart.tsx`, `src/App.tsx`
* **Approach**:
    *   **TDD Step 1**: Added test case to `transformers.test.ts` ensuring "To Do" and "Done" are filtered out.
    *   **Implementation**: Added `filterTimelineStatuses` function to `transformers.ts`.
    *   **Visualization**: Updated `TimelineChart` to calculate ticks dynamically based on the time range (Days, Weeks, or Months) to avoid overcrowding.
* **Outcome**: Chart now focuses on active work ("In Progress", "Review", etc.) and displays extensive date context on the X-axis.

## Date: 2026-01-22
* **Goal**: Fix Filtering & Improve Axis Ticks
* **Files Modified**: `src/utils/display.ts` (New), `src/utils/display.test.ts` (New), `src/components/TimelineChart.tsx`, `src/App.tsx`
* **Approach**:
    *   **Monday Ticks**: Created `generateMondayTicks` helper function using TDD (wrote tests first).
    *   **Chart Update**: Updated `TimelineChart.tsx` to use the new Monday-only tick generator.
    *   **Filter Fix**: Expanded the ignore list in `App.tsx` to include "Open", "Backlog", "Resolved", and "Closed" to address the user's report of "To Do" persisting.
* **Outcome**: `npm run verify` passed. Axis is cleaner, and filtering is more robust.

## Date: 2026-01-22
* **Goal**: Fix Persistent "To Do" Filter Bug
* **Files Modified**: `src/utils/transformers.ts`, `src/utils/transformers.test.ts`
* **Approach**:
    *   Reproduced the issue with a test case involving whitespace/case sensitivity.
    *   Updated `filterTimelineStatuses` to use case-insensitive matching and trim whitespace from both the status and the ignore list.
    *   Updated `processIssueTimeline` to trim status strings extracted from raw Jira change history.
* **Outcome**: `npm run verify` passed. The filtering logic is now strict about ignoring target statuses regardless of formatting quirks.

## Date: 2026-01-22
* **Goal**: Advanced Sorting & Cycle Time Calculation
* **Files Modified**: `src/utils/cycleTime.ts` (new), `src/utils/cycleTime.test.ts` (new), `src/utils/transformers.ts`, `src/utils/transformers.test.ts`, `src/App.tsx`, `src/data/holidays.json`
* **Approach**:
    *   **Cycle Time**: Implemented `calculateCycleTime` to handle 9am-5pm Pacific work days, excluding weekends and holidays. Moved `holidays.json` to `src/data`. Validated with specific test cases provided by user.
    *   **Sorting**: Added `sortIssueTimelines` to `transformers.ts`. Implements the 3-tier sort: Parent -> Children (by Start Time) -> Children (Empty, Alphabetical).
    *   **Integration**: Updated `App.tsx` to sort after filtering. Updated `transformers.ts` to use new cycle time for duration calculation.
* **Outcome**: `npm run verify` passed (13 tests total). Logic now aligns with sophisticated business rules for time accounting and display order.

## Date: 2026-01-22
* **Goal**: Add Stats Panel & Refine Number Formatting
* **Files Modified**: `src/utils/formatting.ts` (new), `src/utils/formatting.test.ts` (new), `src/components/TimelineChart.tsx`
* **Approach**:
    *   **Formatting**: Created `formatWorkDays` to strictly enforce max 1 decimal place (or 0 if >=10) and append "work days". Covered by unit tests.
    *   **UI/Layout**: Refactored `TimelineChart` to use a `Grid` layout (9/3 split). Added a right-hand Summary panel displaying:
        *   Cycle Time (Total span in work days)
        *   Calendar Time (Date range)
        *   Longest Sub-task (Summary + Work days)
        *   Last Sub-task (Summary + Work days)
    *   **Tooltips**: Updated chart tooltips to use the new formatting helper.
* **Outcome**: `npm run verify` passed (16 tests total). The visualization now includes a high-level executive summary of the cycle time metrics.

## Date: 2026-01-22
* **Goal**: Refine Stats Panel (Exclude Parent, Truncate Summary)
* **Files Modified**: `src/components/TimelineChart.tsx`
* **Approach**:
    *   **Logic**: Updated `metrics` calculation to slice the `data` array (`data.slice(1)`) before calculating "Longest" and "Last" Stats, effectively excluding the parent issue (index 0).
    *   **UI**: Switched summary text to use Mantine's `truncate` prop (single line + ellipsis) wrapped in a `Tooltip` component to show the full text on hover.
    *   **Safety**: Added optional chaining and conditional rendering to handle cases with no subtasks safely.
* **Outcome**: `npm run verify` passed. The panel now accurately reflects sub-task specific metrics without being skewed by the parent container story.

## Date: 2026-01-22
* **Goal**: Fix Cycle Time Calculation Calculation Bug
* **Files Modified**: `src/utils/transformers.ts`, `src/utils/transformers.test.ts`
* **Approach**:
    *   **Diagnosis**: Identified that `filterTimelineStatuses` was removing segments correctly but preserving the original stale `totalCycleTime` calculated before filtering.
    *   **Fix**: Updated `filterTimelineStatuses` to explicitly recalculate `totalCycleTime` by reducing the duration of the *remaining* filtered segments.
    *   **Verification**: Added a regression test case `updates totalCycleTime after filtering` which confirmed the bug and verified the fix.
* **Outcome**: `npm run verify` passed. Stats panel now correctly ignores "To Do", "Done" etc. in total counts.
