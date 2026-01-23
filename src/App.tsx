import { useState, useMemo, useEffect } from 'react';
import { AppShell, Burger, Group, Text, TextInput, Button, Container, Paper, Alert, Stack, Grid } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { startOfWeek, addDays, differenceInMinutes } from 'date-fns';
import { type MRT_ExpandedState } from 'mantine-react-table';
import { processParentsAndChildren, IssueTimeline, filterTimelineStatuses, buildIssueTree } from './utils/transformers';
import { calculateNextExpanded } from './utils/treeUtils';
import { IssueTreeTable } from './components/IssueTreeTable';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [issueId, setIssueId] = useState('CGM-3458');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<IssueTimeline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MRT_ExpandedState>(true);
  const [areSubtasksVisible, setAreSubtasksVisible] = useState(true);

  // Reset expansion when data significantly changes
  useEffect(() => {
     if(timelineData) {
        setExpanded(true);
        setAreSubtasksVisible(true);
     }
  }, [timelineData]);

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

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text size="lg" fw={700}>Jira Cycle Time</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text>Previous Searches (ToDo)</Text>
      </AppShell.Navbar>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', paddingBottom: 0, minHeight: 0 }}>
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
                />
              </div>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
