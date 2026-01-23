# Project Rules for Team Roadmaps

You are working on the Team Roadmaps project. You must adhere to the following strictly:

## The "Definition of Done" Protocol
Before telling the user a task is complete, you MUST perform these 3 steps in order (or run the `npm run verify` shortcut):

1.  **LINT**: Run `npm run lint` (and `npm run lint -- --fix` if needed).
2.  **TEST**: Run `npm test`. All tests must pass.
3.  **BUILD**: Run `npm run build`.

## Documentation
*   You must maintain `copilot_journal.md`. 
*   After the verification steps pass, add an entry to the journal summarizing the changes. Include the local datetime for each entry.
*   **Do not** ask the user if they want to update the journal. Just do it.

## Behavior
*   If a test fails, fix it. Do not ask for permission to fix regressions.
*   Never output code that breaks the `npm run verify` chain.
