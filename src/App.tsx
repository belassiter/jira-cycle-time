import { useState, useMemo, useEffect } from 'react';
import { AppShell, Group, Text, TextInput, Button, Container, Paper, Alert, Stack, Grid, Divider, Tooltip } from '@mantine/core'; // Added Divider
import { useDisclosure } from '@mantine/hooks';
import { startOfWeek, addDays, differenceInMinutes } from 'date-fns'; // Added differenceInDays
import { type MRT_ExpandedState, type MRT_RowSelectionState, type MRT_Updater } from 'mantine-react-table'; // Added type MRT_RowSelectionState
import { processParentsAndChildren, IssueTimeline, filterTimelineStatuses, buildIssueTree } from './utils/transformers';
import { calculateNextExpanded, buildAdjacencyMap } from './utils/treeUtils';
import { calculateIssueStats, formatMetric, type SelectedIssueStats } from './utils/stats';
import { handleSingleSelectionChange } from './utils/selectionLogic';
import { IssueTreeTable } from './components/IssueTreeTable';

export default function App() {
  const [opened] = useDisclosure();
  const [issueId, setIssueId] = useState('CGM-3458');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<IssueTimeline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MRT_ExpandedState>(true);
  const [areSubtasksVisible, setAreSubtasksVisible] = useState(true);
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({}); // New State
  
  // Stats Calculation State
  const [selectedStats, setSelectedStats] = useState<SelectedIssueStats | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Lazy-load Parent/Child Adjacency Map for O(1) traversal
  const relationsMap = useMemo(() => {
     if (!timelineData) return new Map<string, string[]>();
     return buildAdjacencyMap(timelineData);
  }, [timelineData]);

  // Custom handler to enforce single selection behavior even with checkboxes
  // Updated to provide IMMEDIATE feedback (Spinner) on click
  const handleRowSelectionChange = (updater: MRT_Updater<MRT_RowSelectionState>) => {
      const newSelection = handleSingleSelectionChange(updater, rowSelection);
      setRowSelection(newSelection);

      // If we have a selection, immediately signal "Calculating" 
      // This ensures the spinner appears on the very next render (checkbox click)
      const hasSelection = Object.keys(newSelection).some(k => newSelection[k]);
      if (hasSelection) {
          setIsCalculating(true);
          setSelectedStats(null); // Clear old stats immediately
      } else {
          setIsCalculating(false);
          setSelectedStats(null);
      }
  };

  // Reset expansion and stats when data significantly changes
  useEffect(() => {
     if(timelineData) {
        setExpanded(true);
        setAreSubtasksVisible(true);
        setRowSelection({}); // Reset selection
        setSelectedStats(null);
     }
  }, [timelineData]);
  
  // Derived state for Statistics Panel - Moved to Effect for async calculation to unblock UI
  useEffect(() => {
      // Check if any row is selected
      const selectedId = Object.keys(rowSelection).find(k => rowSelection[k]);
      
      if (!selectedId) {
          // If logic handled in handler, this might be redundant but safe
          setIsCalculating(false);
          return;
      }

      // Defer calculation to allow render cycle (showing spinner)
      // The debounce also helps if the user clicks rapidly between rows
      const timer = setTimeout(() => {
          const stats = calculateIssueStats(rowSelection, timelineData, relationsMap);
          setSelectedStats(stats);
          setIsCalculating(false);
      }, 50);

      return () => clearTimeout(timer);
  }, [rowSelection, timelineData, relationsMap]);

  const handlePullData = async (targetId: string = issueId) => {
    if (!targetId) return;
    
    setLoading(true);
    setError(null);
    setTimelineData(null);

    try {
      const result = await window.ipcRenderer.getIssue(targetId);
      if (result.success) {
        const timelines = processParentsAndChildren(result.data);
        const filtered = filterTimelineStatuses(timelines, ['To Do', 'Open', 'Backlog', 'Done', 'Resolved', 'Closed']);
        setTimelineData(filtered);
      } else {
        setError(result.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with backend');
    } finally {
      setLoading(false);
    }
  };

  // Convert flat list to tree structure for MRT
  const treeData = useMemo(() => {
    if (!timelineData) return [];
    return buildIssueTree(timelineData);
  }, [timelineData]);

  const toggleSubtasks = () => {
     const { nextExpanded, nextAreSubtasksVisible } = calculateNextExpanded(expanded, treeData, areSubtasksVisible);
     setExpanded(nextExpanded);
     setAreSubtasksVisible(nextAreSubtasksVisible);
  };

  // Calculate global date range for the visualization
  const { minDate, maxDate, totalMinutes } = useMemo(() => {
        if (!timelineData || timelineData.length === 0) return { minDate: new Date(), maxDate: new Date(), totalMinutes: 1 };
        
        let min = new Date(8640000000000000);
        let max = new Date(0);
        let hasData = false;

        timelineData.forEach(issue => {
            issue.segments.forEach(seg => {
                hasData = true;
                if (seg.start < min) min = seg.start;
                if (seg.end > max) max = seg.end;
            });
        });

        if (!hasData) {
            min = new Date();
            max = addDays(new Date(), 1);
        }

        // Snap minDate to the start of the week (Monday) to ensure ticks align with 0%
        // This prevents the "First tick is at -2 days" issue if the project started on Wed.
        const alignedMin = startOfWeek(min, { weekStartsOn: 1 });
        
        const displayMax = addDays(max, 1);
        const total = differenceInMinutes(displayMax, alignedMin);

        return { minDate: alignedMin, maxDate: displayMax, totalMinutes: total };
  }, [timelineData]);

  // Derived state for Statistics Panel
  // Moved to useEffect above



  return (
    <AppShell
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Navbar p="md">
        {selectedStats ? (
            <Stack gap="xs">
                <Text fw={700} size="lg" style={{ borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Statistics</Text>
                
                <Text fw={600} c="blue">{selectedStats.key}</Text>
                <Tooltip label={selectedStats.summary} multiline w={250} withinPortal>
                    <Text size="xs" c="dimmed" truncate mb="sm">{selectedStats.summary}</Text>
                </Tooltip>

                <Group justify="space-between">
                    <Text size="sm">Cycle Time:</Text>
                    <Text fw={500}>{formatMetric(selectedStats.cycleTime)} work days</Text>
                </Group>
                <Group justify="space-between">
                    <Text size="sm">Calendar Time:</Text>
                    <Text fw={500}>{formatMetric(selectedStats.calendarWeeks)} weeks</Text>
                </Group>
                
                <Divider my="sm" />
                
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">{selectedStats.childLevel} Cycle Time</Text>

                {selectedStats.average && (
                    <Group justify="space-between" align="flex-start">
                        <Text size="sm">Average:</Text>
                        <Text fw={500} size="sm">{selectedStats.average}</Text>
                    </Group>
                )}

                <Stack gap={0} mt="xs">
                    <Text size="sm">Longest:</Text>
                    <Group justify="space-between" align="center" wrap="nowrap">
                         <Tooltip label={selectedStats.longestSubtask?.summary} multiline w={250} withinPortal>
                            <Text size="xs" c="blue" component="span" truncate style={{ flex: 1, cursor: 'help' }}>
                                {selectedStats.longestSubtask?.summary}
                            </Text>
                         </Tooltip>
                         <Text fw={500} size="sm" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{selectedStats.longestSubtask?.val}</Text>
                    </Group>
                </Stack>

                <Stack gap={0} mt="xs">
                    <Text size="sm">Last:</Text>
                    <Group justify="space-between" align="center" wrap="nowrap">
                         <Tooltip label={selectedStats.lastSubtask?.summary} multiline w={250} withinPortal>
                             <Text size="xs" c="blue" component="span" truncate style={{ flex: 1, cursor: 'help' }}>
                                {selectedStats.lastSubtask?.summary}
                             </Text>
                         </Tooltip>
                         <Text fw={500} size="sm" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{selectedStats.lastSubtask?.val}</Text>
                    </Group>
                </Stack>
            </Stack>
        ) : (
            <Text>Select a row to view statistics.</Text>
        )}
      </AppShell.Navbar>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: 0, minHeight: 0 }}>
        <Container fluid style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, paddingBottom: 0 }}> 
          <Stack style={{ flex: 1, overflow: 'hidden', minHeight: 0 }} gap="md"> 
            
            <Paper p="md" withBorder style={{ flexShrink: 0 }}>
              <Grid align="flex-end">
                <Grid.Col span={6}>
                    <Group align="flex-end">
                        <TextInput 
                        label="Jira Issue ID" 
                        placeholder="e.g. PROJ-123" 
                        value={issueId}
                        onChange={(e) => setIssueId(e.target.value)}
                        style={{ flex: 1 }}
                        />
                        <Button onClick={() => handlePullData(issueId)} loading={loading}>
                        Pull Data
                        </Button>
                    </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                    <Group justify="flex-end">
                        <Button 
                            variant={areSubtasksVisible ? "light" : "filled"} 
                            color={areSubtasksVisible ? "gray" : "blue"}
                            size="sm" 
                            onClick={toggleSubtasks}
                        >
                            {areSubtasksVisible ? "Collapse Sub-tasks" : "Expand Sub-tasks"}
                        </Button>
                    </Group>
                </Grid.Col>
              </Grid>
            </Paper>

            {error && (
              <Alert color="red" title="Error">
                {error}
              </Alert>
            )}

            {treeData.length > 0 && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <IssueTreeTable 
                    data={treeData} 
                    minDate={minDate}
                    maxDate={maxDate}
                    totalMinutes={totalMinutes}
                    expanded={expanded}
                    onExpandedChange={setExpanded}
                    rowSelection={rowSelection}
                    onRowSelectionChange={handleRowSelectionChange}
                    isCalculating={isCalculating}
                />
              </div>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
