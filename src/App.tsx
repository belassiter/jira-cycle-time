import { useState, useMemo, useEffect, useRef } from 'react';
import { AppShell, Group, Text, TextInput, Button, Container, Paper, Alert, Stack, Grid, Divider, Tooltip, Modal, ActionIcon, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { startOfWeek, addDays, differenceInMinutes } from 'date-fns';
import { type MRT_ExpandedState, type MRT_RowSelectionState, type MRT_Updater } from 'mantine-react-table';
import { IconSettings, IconChartDots, IconDownload, IconKey } from '@tabler/icons-react';
import { ParentSize } from '@visx/responsive';

import { processParentsAndChildren, IssueTimeline, filterTimelineStatuses, buildIssueTree, filterTimelineByIssueType } from './utils/transformers';
import { calculateNextExpanded, buildAdjacencyMap } from './utils/treeUtils';
import { calculateIssueStats, formatMetric, type SelectedIssueStats, type GroupStatistic } from './utils/stats';
import { handleToggleWithDescendants } from './utils/selectionLogic';
import { IssueTreeTable } from './components/IssueTreeTable';
import { GroupsManager } from './components/GroupsManager';
import { CredentialsModal } from './components/CredentialsModal';
import { DistributionChart, DistributionChartRef } from './components/DistributionChart'; // Updated import
import { SubTaskGroup, groupSubTasks, OTHER_GROUP_ID, OTHER_GROUP_NAME } from './utils/grouping';
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
const DEFAULT_EXCLUDED_STATUSES = ['To Do', 'Todo', 'Done', 'Closed', 'In Refinement', 'Backlog', 'Ready', 'On Hold', 'Canceled', 'Cancelled', 'Ready for Refinement', 'New', 'Blocked/On Hold'];
export default function App() {
  const [opened] = useDisclosure();
  const [issueId, setIssueId] = useState('CGM-3458');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<IssueTimeline[] | null>(null);
  const [allIssueTimelines, setAllIssueTimelines] = useState<IssueTimeline[] | null>(null); // Store raw data for dynamic filtering
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MRT_ExpandedState>(true);
  const [areSubtasksVisible, setAreSubtasksVisible] = useState(true);
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});

  // Settings State
  const [subTaskGroups, setSubTaskGroups] = useState<SubTaskGroup[]>(DEFAULT_GROUPS);
  const [excludedStatuses, setExcludedStatuses] = useState<string[]>(DEFAULT_EXCLUDED_STATUSES);
  const [excludedIssueTypes, setExcludedIssueTypes] = useState<string[]>([]);
  const [groupsModalOpen, { open: openGroupsModal, close: closeGroupsModal }] = useDisclosure(false);
  const [chartModalOpen, { open: openChartModal, close: closeChartModal }] = useDisclosure(false);
  const [chartType, setChartType] = useState<'subtask' | 'story'>('subtask');
  
  // Credentials
  const [credentialsModalOpen, { open: openCredentialsModal, close: closeCredentialsModal }] = useDisclosure(false);
  const [hasValidCredentials, setHasValidCredentials] = useState(false);

  // Check credentials on mount
  useEffect(() => {
    const checkCreds = async () => {
        try {
            // @ts-ignore
            const exists = await window.ipcRenderer.invoke('has-credentials');
            setHasValidCredentials(exists);
            if (!exists) {
                openCredentialsModal();
            }
        } catch (e) {
            console.error("Failed to check credentials", e);
        }
    };
    checkCreds();
  }, []);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('jira-cycle-time-settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if(parsed.subTaskGroups) setSubTaskGroups(parsed.subTaskGroups);
            if(parsed.excludedStatuses) setExcludedStatuses(parsed.excludedStatuses);
            if(parsed.excludedIssueTypes) setExcludedIssueTypes(parsed.excludedIssueTypes);
        } catch(e) { console.error("Failed to load settings", e); }
    }
  }, []); // Run once on mount

  useEffect(() => {
      const settings = { subTaskGroups, excludedStatuses, excludedIssueTypes };
      localStorage.setItem('jira-cycle-time-settings', JSON.stringify(settings));
  }, [subTaskGroups, excludedStatuses, excludedIssueTypes]);
  
  // Stats Calculation State
  const [selectedStats, setSelectedStats] = useState<SelectedIssueStats | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  const chartRef = useRef<DistributionChartRef>(null);

  // Lazy-load Parent/Child Adjacency Map for O(1) traversal
  // Must use 'allIssueTimelines' (raw data) to ensure structure exists even if items are filtered out
  const relationsMap = useMemo(() => {
     if (!allIssueTimelines) return new Map<string, string[]>();
     return buildAdjacencyMap(allIssueTimelines);
  }, [allIssueTimelines]);

  const handleRowSelectionChange = (updater: MRT_Updater<MRT_RowSelectionState>) => {
      const newSelection = handleToggleWithDescendants(updater, rowSelection, relationsMap);
      setRowSelection(newSelection);
  };

  useEffect(() => {
     if(allIssueTimelines) {
        setExpanded(true);
        setAreSubtasksVisible(true);
        setRowSelection({}); 
        setSelectedStats(null);
     }
  }, [allIssueTimelines]);

  // Effect to apply status & issue type filtering whenever raw data or exclusion lists change
  useEffect(() => {
      if (!allIssueTimelines) {
          setTimelineData(null);
          return;
      }

      // Filter by Issue Type (including all descendants of excluded types)
      const filteredByIssueType = filterTimelineByIssueType(allIssueTimelines, excludedIssueTypes, relationsMap);

      // Then filter by Status segments
      const filtered = filterTimelineStatuses(filteredByIssueType, excludedStatuses);
      setTimelineData(filtered);
      // NOTE: We do NOT clear selection here anymore, to retain it during filter changes
  }, [allIssueTimelines, excludedStatuses, excludedIssueTypes, relationsMap]);
  
  useEffect(() => {
      const selectedId = Object.keys(rowSelection).find(k => rowSelection[k]);
      
      if (!selectedId) {
          setIsCalculating(false);
          setSelectedStats(null);
          return;
      }

      setIsCalculating(true); // Set immediately when dependencies change

      const timer = setTimeout(() => {
          // Pass subTaskGroups to the calculation
          const stats = calculateIssueStats(rowSelection, timelineData, relationsMap, subTaskGroups);
          setSelectedStats(stats);
          setIsCalculating(false);
      }, 300); // 300ms debounce to avoid flicker during rapid settings changes

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
        setAllIssueTimelines(timelines); // Save raw
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

  // Chart Data Preparation
  const chartConfig = useMemo(() => {
     if (!selectedStats || !chartModalOpen) return null;

     if (chartType === 'subtask' && selectedStats.subTaskStats) {
         const allGroups = [...subTaskGroups, { id: OTHER_GROUP_ID, name: OTHER_GROUP_NAME, keywords: [] }];
         
         const selectedKeys = Object.keys(rowSelection).filter(k => rowSelection[k]);
         if (!timelineData) return null;
         const participants = timelineData.filter(t => selectedKeys.includes(t.key));
         const subtasks = participants.filter(d => d.issueType === 'Sub-task');
         const grouped = groupSubTasks(subtasks, subTaskGroups);
         
         const data: any[] = [];
         for (const [groupId, items] of Object.entries(grouped)) {
             items.forEach(item => {
                 const grp = allGroups.find(g => g.id === groupId);
                 if (item.totalCycleTime > 0) {
                    data.push({
                        id: item.key,
                        key: item.key,
                        summary: item.summary,
                        value: item.totalCycleTime,
                        category: grp ? grp.name : groupId,
                        url: item.url
                    });
                 }
             });
         }
         
         return {
             title: 'Sub-task Distribution',
             data,
             categories: allGroups.map(g => ({ id: g.id, name: g.name })),
             stats: selectedStats.subTaskStats.groups
         };
     } 
     
     if (chartType === 'story' && selectedStats.storyStats) {
         const data = selectedStats.storyStats.distribution;
         const uniqueCats = Array.from(new Set(data.map(d => d.category)));
         const catStats: GroupStatistic[] = uniqueCats.map(cat => {
             const values = data.filter(d => d.category === cat).map(d => d.value);
             const sum = values.reduce((a,b)=>a+b,0);
             const mean = sum / values.length;
             const sqDiff = values.reduce((a,b) => a + Math.pow(b - mean, 2), 0);
             const stdDev = Math.sqrt(sqDiff / (values.length - 1 || 1));
             return {
                 groupId: cat,
                 groupName: cat,
                 average: mean,
                 stdDev: stdDev,
                 count: values.length,
                 tooltip: formatMetric(mean)
             };
         });
         
         return {
             title: 'Story/Task Distribution',
             data,
             categories: uniqueCats.map(c => ({ id: c, name: c })),
             stats: catStats
         };
     }

     return null;
  }, [selectedStats, chartType, subTaskGroups, rowSelection, timelineData, chartModalOpen]);

  // Aggregate all known subtasks for the Groups Manager
  const allKnownSubtasks = useMemo(() => {
      if (!timelineData) return [];
      return timelineData.filter(t => t.issueType === 'Sub-task');
  }, [timelineData]);
  
  // Aggregate all unique statuses from raw data for the settings list
  const statusStats = useMemo(() => {
      if (!allIssueTimelines) return { statuses: [], counts: {} as Record<string, number> };
      const counts: Record<string, number> = {};
      allIssueTimelines.forEach(t => {
         // Count occurrences across all issues. 
         // One issue might hit the same status multiple times? 
         // User: "number of jira issues that go through that status"
         const seenInThisIssue = new Set<string>();
         t.segments.forEach(s => {
             if (s.status) {
                 const norm = s.status.trim();
                 seenInThisIssue.add(norm);
             }
         });
         seenInThisIssue.forEach(s => {
             counts[s] = (counts[s] || 0) + 1;
         });
      });
      const statuses = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'accent' }));
      return { statuses, counts };
  }, [allIssueTimelines]);

  const issueTypeStats = useMemo(() => {
    if (!allIssueTimelines) return { types: [], counts: {} as Record<string, number> };
    const counts: Record<string, number> = {};
    allIssueTimelines.forEach(t => {
        if (t.issueType) {
            counts[t.issueType] = (counts[t.issueType] || 0) + 1;
        }
    });
    const types = Object.keys(counts).sort();
    return { types, counts };
  }, [allIssueTimelines]);

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
        <div style={{ position: 'relative' }}>
        {isCalculating && (
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
            }}>
                <Stack align="center" gap="xs">
                    <Text size="sm" fw={500}>Calculating...</Text>
                </Stack>
            </div>
        )}
        {selectedStats ? (
            <Stack gap={0}>
                <Text fw={700} size="lg" style={{ borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px' }}>Statistics</Text>
                
                <Text fw={600} c="blue" mb={4}>{selectedStats.key}</Text>
                {selectedStats.summary !== 'Multiple items selected' ? (
                   <Tooltip label={selectedStats.summary} multiline w={250} withinPortal>
                      <Text size="xs" c="dimmed" truncate mb="sm">{selectedStats.summary}</Text>
                   </Tooltip>
                ) : (
                   selectedStats.rootSummary && (
                       <Tooltip label={selectedStats.rootSummary} multiline w={250} withinPortal>
                          <Text size="xs" c="dimmed" truncate mb="sm">{selectedStats.rootSummary}</Text>
                       </Tooltip>
                   )
                )}

                <Group justify="space-between" mb={2}>
                    <Text size="sm">Total Cycle Time:</Text>
                    <Text fw={500}>{formatMetric(selectedStats.totalCycleTime)} work days</Text>
                </Group>
                <Group justify="space-between" mb={2}>
                    <Text size="sm">Total Calendar Time:</Text>
                    <Text fw={500}>{formatMetric(selectedStats.totalCalendarWeeks)} weeks</Text>
                </Group>

                {/* EPIC Section - Only show if more than one epic or specific conditions met (User Req: If only one Epic selected, don't show) 
                    Actually, if 'key' is an Epic Key, and we selected just that ONE epic (and its children), 
                    then selectedStats.key is that Epic. 
                    epicStats.count would be 1.
                */}
                {selectedStats.epicStats && selectedStats.epicStats.count > 1 && (
                    <>
                        <Divider my="sm" />
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Epic</Text>
                        
                        <Group justify="space-between" align="flex-start" mb={2}>
                            <Text size="sm">Average:</Text>
                            <Text fw={500} size="sm">{selectedStats.epicStats.average}</Text>
                        </Group>

                        {selectedStats.epicStats.longest && (
                            <Stack gap={0} mt={2}>
                                <Text size="sm">Longest:</Text>
                                <Group justify="space-between" align="center" wrap="nowrap">
                                    <Tooltip label={selectedStats.epicStats.longest.summary} multiline w={250} withinPortal>
                                        <Text size="xs" c="blue" component="span" truncate style={{ flex: 1, cursor: 'help' }}>
                                            {selectedStats.epicStats.longest.summary}
                                        </Text>
                                    </Tooltip>
                                    <Text fw={500} size="sm" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{selectedStats.epicStats.longest.val} work days</Text>
                                </Group>
                            </Stack>
                        )}
                    </>
                )}
                
                {/* STORY/TASK Section */}
                {selectedStats.storyStats && (
                    <>
                        <Divider my="sm" />
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Story/Task</Text>

                        <Group justify="space-between" align="flex-start" mb={2}>
                            <Text size="sm">Average:</Text>
                            <Text fw={500} size="sm">{selectedStats.storyStats.average}</Text>
                        </Group>

                        {selectedStats.storyStats.longest && (
                            <Stack gap={0} mt={2}>
                                <Text size="sm">Longest:</Text>
                                <Group justify="space-between" align="center" wrap="nowrap">
                                        <Tooltip label={selectedStats.storyStats.longest.summary} multiline w={250} withinPortal>
                                        <Text size="xs" c="blue" component="span" truncate style={{ flex: 1, cursor: 'help' }}>
                                            {selectedStats.storyStats.longest.summary}
                                        </Text>
                                        </Tooltip>
                                        <Text fw={500} size="sm" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{selectedStats.storyStats.longest.val} work days</Text>
                                </Group>
                            </Stack>
                        )}

                        {selectedStats.storyStats.last && (
                            <Stack gap={0} mt={2}>
                                <Text size="sm">Last:</Text>
                                <Group justify="space-between" align="center" wrap="nowrap">
                                        <Tooltip label={selectedStats.storyStats.last.summary} multiline w={250} withinPortal>
                                            <Text size="xs" c="blue" component="span" truncate style={{ flex: 1, cursor: 'help' }}>
                                            {selectedStats.storyStats.last.summary}
                                            </Text>
                                        </Tooltip>
                                        <Text fw={500} size="sm" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{selectedStats.storyStats.last.val} work days</Text>
                                </Group>
                            </Stack>
                        )}
                    </>
                )}

                {/* Sub-task Grouping Stats */}
                {selectedStats.subTaskStats && (
                    <>
                        <Divider my="sm" />
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Sub-task Groups</Text>
                         
                         {/* Global Sub-task Average */}
                         <Group justify="space-between" mb={4}>
                            <Text size="sm" fw={500}>Average:</Text>
                            <Text size="sm">{selectedStats.subTaskStats.globalAverage}</Text>
                         </Group>

                        {selectedStats.subTaskStats.groups.map(g => (
                            <Group key={g.groupId} justify="space-between" wrap="nowrap" mb={2}>
                                <Text size="sm" truncate>{g.groupName} ({g.count}):</Text>
                                <Tooltip label={`${g.count} tasks`}> 
                                    <Text 
                                        size="sm" 
                                        style={{
                                            cursor:'help', 
                                            color: interpolateColor(g.average, groupStatsColorRange.min, groupStatsColorRange.max),
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {g.tooltip}
                                    </Text>
                                </Tooltip>
                            </Group>
                        ))}

                        {selectedStats.subTaskStats.longestGroup && (
                            <Stack gap={0} mt={2}>
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
                        )}

                        {selectedStats.subTaskStats.lastGroup && (
                            <Stack gap={0} mt={2}>
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
                        )}
                    </>
                )}

                <Button 
                    leftSection={<IconChartDots size={16} />} 
                    variant="light" 
                    fullWidth 
                    mt="sm" 
                    size="xs"
                    onClick={() => {
                        if (selectedStats?.subTaskStats) setChartType('subtask');
                        else if (selectedStats?.storyStats) setChartType('story');
                        openChartModal();
                    }}
                >
                    Distribution Plots
                </Button>
            </Stack>
        ) : (
            <Text>Select rows in the table to view combined statistics.</Text>
        )}
        </div>
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
                        <Button 
                            variant={areSubtasksVisible ? "light" : "filled"} 
                            color={areSubtasksVisible ? "gray" : "blue"}
                            size="sm" 
                            onClick={toggleSubtasks}
                        >
                            {areSubtasksVisible ? "Collapse Sub-tasks" : "Expand Sub-tasks"}
                        </Button>

                        <Tooltip label="Jira Credentials">
                            <ActionIcon variant="default" size="lg" onClick={openCredentialsModal} aria-label="Credentials">
                                <IconKey size={20} />
                            </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Settings">
                            <ActionIcon variant="default" size="lg" onClick={openGroupsModal} aria-label="Settings">
                                <IconSettings size={20} />
                            </ActionIcon>
                        </Tooltip>
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
      
      <CredentialsModal 
        opened={credentialsModalOpen} 
        onClose={() => {
            closeCredentialsModal();
            setHasValidCredentials(true);
        }} 
        canClose={hasValidCredentials}
      />

      <Modal 
        opened={groupsModalOpen} 
        onClose={closeGroupsModal} 
        title="Settings" 
        size="95%"
        styles={{
            content: { height: '90vh', display: 'flex', flexDirection: 'column' },
            body: { flex: 1, overflow: 'hidden', display: 'flex' }
        }}
      >
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <GroupsManager 
                groups={subTaskGroups} 
                onChange={setSubTaskGroups} 
                allSubTasks={allKnownSubtasks}
                excludedStatuses={excludedStatuses}
                onExcludedChange={setExcludedStatuses}
                allStatuses={statusStats.statuses}
                statusCounts={statusStats.counts}
                excludedIssueTypes={excludedIssueTypes}
                onExcludedIssueTypesChange={setExcludedIssueTypes}
                allIssueTypes={issueTypeStats.types}
                issueTypeCounts={issueTypeStats.counts}
            />
         </div>
      </Modal>

      <Modal 
          opened={chartModalOpen} 
          onClose={closeChartModal} 
          title={
              <Group gap="xs" style={{ width: '100%' }}>
                  <Select
                        data={[
                            { value: 'subtask', label: 'Sub-task Distribution' },
                            { value: 'story', label: 'Story Distribution' }
                        ]}
                        value={chartType}
                        onChange={(value) => value && setChartType(value as 'subtask' | 'story')}
                        allowDeselect={false}
                        size="md"
                        w={300}
                        comboboxProps={{ withinPortal: false }}
                  />
                  <div style={{ flex: 1 }} />
                  <ActionIcon 
                      size="lg" 
                      variant="subtle" 
                      color="gray"
                      onClick={() => chartRef.current?.downloadChart()}
                      title="Download PNG"
                  >
                      <IconDownload size={20} />
                  </ActionIcon>
              </Group>
          } 
          size="90%"
          styles={{
            header: { width: '100%', paddingRight: 40 }, // Ensure header takes full width, reserve space for close button
            title: { width: '100%', paddingRight: 10 },    // Title container takes full width
            content: { height: '85vh', display: 'flex', flexDirection: 'column' },
            body: { flex: 1, overflow: 'hidden', display: 'flex' }
          }}
      >
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
             {chartConfig && (
                <ParentSize>
                    {({ width, height }) => (
                        <DistributionChart 
                            ref={chartRef}
                            width={width} 
                            height={height}
                            data={chartConfig.data} 
                            categories={chartConfig.categories} 
                            stats={chartConfig.stats} 
                            title={chartConfig.title}
                        />
                    )}
                </ParentSize>
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
