I'm writing here a rough list of requirements so we can get started.

App's goal: pull Jira data via API and display cycle time data for a Story and its subtasks

POC
 - [X] Connect with Jira API. Use API key from a local file to start.
 - [X] There's a web app
 - [X] User enters a Jira issue ID, e.g. CGM-1549, presses Pull Data
 - [X] If that issue is a Story or Task type, pull status history data for that and all child sub-tasks. Basically, whenever it changed status, the datetime and what the new status is. Maybe as a ledger
 - [X] Display a timeline view. x-axis is time, showing date at some resolution. y-axis has a row for the parent (top) each child. There is horiztonal a bar for each status, showing the duration 
 - [ ] The user can specify which statuses to ignore (e.g. "To Do" and "Done")

MVP
 - [ ] User can specify "Status Groups" for display. So "In Progress" might include "In Progress", "Under Test", "Under Review", "Blocked", etc.
 - [ ] User can specify sub-task groups, with heuristics on how to assign sub-tasks into a group
 - [ ] User can see a summary of cycle time for the Parent (the length of a specific Status Group) and children.
 - [ ] User can compare cycle data for Stories within an Epic, for the Story as a whole, and for sub-task groups individually.

Later
 - [ ] 
 - [ ]  
 - [ ] 