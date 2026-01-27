import { useState, useMemo, useEffect } from 'react';
import { AppShell, Group, Text, TextInput, Button, Container, Paper, Alert, Stack, Grid, Divider, Tooltip, Modal, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { startOfWeek, addDays, differenceInMinutes } from 'date-fns';
import { type MRT_ExpandedState, type MRT_RowSelectionState, type MRT_Updater } from 'mantine-react-table';
import { IconSettings, IconChartDots } from '@tabler/icons-react';

import { processParentsAndChildren, IssueTimeline, filterTimelineStatuses, buildIssueTree } from './utils/transformers';
import { calculateNextExpanded, buildAdjacencyMap } from './utils/treeUtils';
import { calculateIssueStats, formatMetric, type SelectedIssueStats } from './utils/stats';
import { handleSingleSelectionChange } from './utils/selectionLogic';
import { IssueTreeTable } from './components/IssueTreeTable';
import { GroupsManager } from './components/GroupsManager';
import { SubTaskChart } from './components/SubTaskChart';
import { SubTaskGroup, groupSubTasks } from './utils/grouping';
import { interpolateColor } from './utils/colors';

const DEFAULT_GROUPS: SubTaskGroup[] = [
  { id: 'sds', name: 'SDS', keywords: ['Design', 'SDS'] },
  { id: 'srs', name: 'SRS', keywords: ['SRS', 'requirements'] },
  { id: 'embedded', name: 'Embedded', keywords: ['embed*', 'SW', 'unit'] }, // Wildcard * supported in logic now
  { id: 'framework', name: 'Test Framework', keywords: ['framework'] },
  { id: 'automation', name: 'Automation', keywords: ['auto*', 'script'] },
  { id: 'manual', name: 'Manual Test', keywords: ['SVAP', 'manual'] },
  { id: 'cid', name: 'CID', keywords: ['CID'] },
  { id: 'gds', name: 'GDS', keywords: ['GDS'] }
];

export default function App() {
  const [opened] = useDisclosure();
  const [issueId, setIssueId] = useState('CGM-3458');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<IssueTimeline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MRT_ExpandedState>(true);
  const [areSubtasksVisible, setAreSubtasksVisible] = useState(true);
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});

  // Sub-task Grouping State
  const [subTaskGroups, setSubTaskGroups] = useState<SubTaskGroup[]>(DEFAULT_GROUPS);
  const [groupsModalOpen, { open: openGroupsModal, close: closeGroupsModal }] = useDisclosure(false);
  const [chartModalOpen, { open: openChartModal, close: closeChartModal }] = useDisclosure(false);
  
  // Stats Calculation State
  const [selectedStats, setSelectedStats] = useState<SelectedIssueStats | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Lazy-load Parent/Child Adjacency Map for O(1) traversal
  const relationsMap = useMemo(() => {
     if (!timelineData) return new Map<string, string[]>();
     return buildAdjacencyMap(timelineData);
  }, [timelineData]);

  const handleRowSelectionChange = (updater: MRT_Updater<MRT_RowSelectionState>) => {
      const newSelection = handleSingleSelectionChange(updater, rowSelection);
      setRowSelection(newSelection);

      const hasSelection = Object.keys(newSelection).some(k => newSelection[k]);
      if (hasSelection) {
          setIsCalculating(true);
          setSelectedStats(null); 
      } else {
          setIsCalculating(false);
          setSelectedStats(null);
      }
  };

  useEffect(() => {
     if(timelineData) {
        setExpanded(true);
        setAreSubtasksVisible(true);
        setRowSelection({}); 
        setSelectedStats(null);
     }
  }, [timelineData]);
  
  useEffect(() => {
      const selectedId = Object.keys(rowSelection).find(k => rowSelection[k]);
      
      if (!selectedId) {
          setIsCalculating(false);
          return;
      }

      const timer = setTimeout(() => {
          // Pass subTaskGroups to the calculation
          const stats = calculateIssueStats(rowSelection, timelineData, relationsMap, subTaskGroups);
          setSelectedStats(stats);
          setIsCalculating(false);
      }, 50);

      return () => clearTimeout(timer);
  }, [rowSelection, timelineData, relationsMap, subTaskGroups]); // Re-calculate when groups change

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

  const treeData = useMemo(() => {
    if (!timelineData) return [];
    return buildIssueTree(timelineData);
  }, [timelineData]);

  const toggleSubtasks = () => {
     const { nextExpanded, nextAreSubtasksVisible } = calculateNextExpanded(expanded, treeData, areSubtasksVisible);
     setExpanded(nextExpanded);
     setAreSubtasksVisible(nextAreSubtasksVisible);
  };

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

        const alignedMin = startOfWeek(min, { weekStartsOn: 1 });
        const displayMax = addDays(max, 1);
        const total = differenceInMinutes(displayMax, alignedMin);

        return { minDate: alignedMin, maxDate: displayMax, totalMinutes: total };
  }, [timelineData]);

  const chartData = useMemo(() => {
      if (!chartModalOpen || !timelineData || !selectedStats?.subTaskStats) return [];
      
      const selectedId = Object.keys(rowSelection).find(k => rowSelection[k]);
      if (!selectedId) return [];

      const subtasks: IssueTimeline[] = [];
      const queue = [selectedId];
      const visited = new Set<string>();

      // Simple BFS using relationsMap
      while(queue.length > 0) {
          const curr = queue.shift()!;
          if(visited.has(curr)) continue;
          visited.add(curr);

          const children = relationsMap.get(curr) || [];
          children.forEach(childKey => {
              const child = timelineData.find(t => t.key === childKey);
              if (child) {
                  if (child.issueType === 'Sub-task') {
                      subtasks.push(child);
                  }
                  queue.push(childKey);
              }
          });
      }

      if (subtasks.length === 0) return [];
      
      const grouped = groupSubTasks(subtasks, subTaskGroups);
      const points: { id: string; groupId: string; value: number }[] = [];

      // Include OTHER_GROUP_ID if not explicit in keys but groupSubTasks returns it
      const allKeys = Object.keys(grouped);
      
      allKeys.forEach(gid => {
          grouped[gid].forEach((t: IssueTimeline) => {
              if (t.totalCycleTime > 0) {
                  points.push({ id: t.key, groupId: gid, value: t.totalCycleTime });
              }
          });
      });

      return points;
  }, [chartModalOpen, timelineData, selectedStats, rowSelection, relationsMap, subTaskGroups]);

  // Aggregate all known subtasks for the Groups Manager
  const allKnownSubtasks = useMemo(() => {
      if (!timelineData) return [];
      return timelineData.filter(t => t.issueType === 'Sub-task');
  }, [timelineData]);

  const groupStatsColorRange = useMemo(() => {
     if (!selectedStats?.subTaskStats?.groups || selectedStats.subTaskStats.groups.length === 0) return { min: 0, max: 0 };
     const avgs = selectedStats.subTaskStats.groups.map(g => g.average);
     return { min: Math.min(...avgs), max: Math.max(...avgs) };
  }, [selectedStats]);


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
        <ScrollArea h="100%">
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
                
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                    {selectedStats.childLevel === 'Sub-task' ? 'Sub-task' : 'Story/Task'}
                </Text>

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

                {/* Sub-task Grouping Stats */}
                {selectedStats.subTaskStats && (
                    <>
                        <Divider my="sm" />
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">Sub-task Groups</Text>
                         
                         {/* Global Sub-task Average */}
                         <Group justify="space-between">
                            <Text size="sm" fw={500}>Average:</Text>
                            <Text size="sm">{selectedStats.subTaskStats.globalAverage}</Text>
                         </Group>

                        {selectedStats.subTaskStats.groups.map(g => (
                            <Group key={g.groupId} justify="space-between">
                                <Text size="sm">{g.groupName} ({g.count}):</Text>
                                <Tooltip label={`${g.count} tasks`}> 
                                    <Text 
                                        size="sm" 
                                        style={{
                                            cursor:'help', 
                                            color: interpolateColor(g.average, groupStatsColorRange.min, groupStatsColorRange.max)
                                        }}
                                    >
                                        {g.tooltip}
                                    </Text>
                                </Tooltip>
                            </Group>
                        ))}

                        <Divider my="xs" variant="dashed" />

                        <Stack gap={0}>
                            <Text size="sm">Longest:</Text>
                             <Group justify="space-between">
                                <Text size="sm" c="blue">{selectedStats.subTaskStats.longestGroup?.groupName || 'N/A'}</Text>
                                <Text 
                                    size="sm"
                                    style={{
                                        color: selectedStats.subTaskStats.longestGroup 
                                            ? interpolateColor(selectedStats.subTaskStats.longestGroup.average, groupStatsColorRange.min, groupStatsColorRange.max)
                                            : undefined
                                    }}
                                >
                                    {selectedStats.subTaskStats.longestGroup?.tooltip || '-'}
                                </Text>
                             </Group>
                        </Stack>

                         <Stack gap={0} mt="xs">
                            <Text size="sm">Last:</Text>
                             <Group justify="space-between">
                                <Text size="sm" c="blue">{selectedStats.subTaskStats.lastGroup?.groupName || 'N/A'}</Text>
                                <Text 
                                    size="sm"
                                    style={{
                                        color: selectedStats.subTaskStats.lastGroup 
                                            ? interpolateColor(selectedStats.subTaskStats.lastGroup.average, groupStatsColorRange.min, groupStatsColorRange.max)
                                            : undefined
                                    }}
                                >
                                    {selectedStats.subTaskStats.lastGroup?.tooltip || '-'}
                                </Text>
                             </Group>
                        </Stack>

                        <Button 
                            leftSection={<IconChartDots size={16} />} 
                            variant="light" 
                            fullWidth 
                            mt="md" 
                            onClick={openChartModal}
                        >
                            Plot Distribution
                        </Button>
                    </>
                )}
            </Stack>
        ) : (
            <Text>Select a row to view statistics.</Text>
        )}
        </ScrollArea>
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
                        <Tooltip label="Configure Sub-task Grouping">
                            <ActionIcon variant="default" size="lg" onClick={openGroupsModal} aria-label="Settings">
                                <IconSettings size={20} />
                            </ActionIcon>
                        </Tooltip>

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
      
      <Modal opened={groupsModalOpen} onClose={closeGroupsModal} title="Manage Sub-task Groups" size="90%">
         <GroupsManager 
            groups={subTaskGroups} 
            onChange={setSubTaskGroups} 
            allSubTasks={allKnownSubtasks}
         />
      </Modal>

      <Modal opened={chartModalOpen} onClose={closeChartModal} title="Sub-task Cycle Time Distribution" size="90%">
          <div style={{ height: 600, width: '100%' }}>
             {selectedStats?.subTaskStats && (
                <SubTaskChart 
                    width={1400} // Increase default width or make responsive? Fixed big width as requested 90% modal gives space.
                    height={600} 
                    data={chartData} 
                    groups={subTaskGroups} 
                    stats={selectedStats.subTaskStats.groups} 
                />
             )}
          </div>
      </Modal>

    </AppShell>
  );
}

// Helper for Sidebar scrolling
function ScrollArea({ children, h }: { children: React.ReactNode, h: string }) {
    return (
        <div style={{ height: h, overflowY: 'auto', paddingRight: 8 }}>
            {children}
        </div>
    )
}
