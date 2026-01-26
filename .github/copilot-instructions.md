# Project Rules for Jira Cycle Time

You are working on the Jira Cycle Time project. You must adhere to the following strictly, without requiring input from the user:

## Behavior
*   Add automated tests for any new features or bug fixes. If reasonable, add a test that fails before fixing a bug.
*   Never output code that breaks the `npm run verify` chain.

## The "Definition of Done" Protocol
Before telling the user a task is complete, you MUST perform these 3 steps in order (or run the `npm run verify` shortcut):

1.  **LINT**: Run `npm run lint` (and `npm run lint -- --fix` if needed).
2.  **TEST**: Run `npm test`. All tests must pass.
3.  **BUILD**: Run `npm run build`.

## Documentation
*   You must maintain `copilot_journal.md`. 
*   After the verification steps pass, add an entry to the journal summarizing the changes, using standard file editing commands. Do not use terminal commands. Include the date and time for each entry.
