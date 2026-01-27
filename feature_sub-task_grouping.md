This is an overview of a new feature: Sub-task Grouping

# Goal
Analyze statistical data on sub-tasks across multiple Stories under an Epic

# Situation: 
1. There is an epic with multiple child Stories, which each have multiple child sub-tasks
1. These sub-tasks can be grouped into categories, based on the Summary field, allowing for better analysis of data
1. Sometimes the Summary text is the same for sub-tasks across Stories. For example, "embedded"
1. Sometimes the Summary will be categorizable using certain keywords such as "automation"
1. Sometimes the Summary may need to be categorized as a one-off

# Details
1. For the left-side box, there will be multiple expand/collapse sections. Currently there is "Statistics". Above that will be "Sub-task Grouping". The left-side box will scroll if needed
1. For sub-task Grouping, the user is shown a consolidated list of sub-task Summary from all sub-tasks that have been loaded
1. The user can Create a "Sub-task Group" with a name.
1. For this group, they can specify a list of keywords that are comma-separated. 
1. The user can create additional Sub-task Groups
1. The user can drag the Sub-task Groups to order them
1. Starting with the first Sub-task Group, the system will use fuzzy matching to assign each sub-task to a Sub-task Group, based on the Summary text
1. Any sub-task not assigned to a Sub-task Group by fuzzy matching will be assigned to "Other"
1. When an Epic is selected in the table, it will display "Sub-task Cycle Time Statistics" in the left box
1. Sub-task Statistics will include, the following:  
    1. Longest - X ± Y work days (for the statistically longest Sub-task Group)
    1. Last - X ± Y work days (for Sub-task Group that is most commonly last)
    1. Average - X ± Y work days (for all Sub-tasks)
    1. [Sub-task Group Name] - X ± Y work days (for each Sub-task Group)
1. For statistics, sub-tasks with cycle time = zero will be ignored
1. Below this, it will have a button for "Plot". This will bring up a modal with a Beeswarm/Strip (jittered dots) plot, with each Sub-task Group as an entry across the x-axis. Each Sub-task Group is a different color. It should show a dot for each datapoint, and also show lines for the average, median, and standard deviation.

# Default sub-task groups
- SDS - Design, SDS
- SRS - SRS, requirements
- Embedded - embed*, SW, unit
- Test Framework - framework
- Automation - auto*, script, 
- Manual Test - SVAP, manual
- CID - CID
- GDS - GDS


