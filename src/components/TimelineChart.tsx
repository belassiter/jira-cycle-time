import { useMemo } from 'react';
import { Box, Tooltip, Text, Group, ScrollArea, Paper, Grid, Stack, Title, Divider, UnstyledButton, Anchor, Button } from '@mantine/core';
import { differenceInMinutes, format, addDays } from 'date-fns';
import { IssueTimeline, getStatusColor } from '../utils/transformers';
import { generateSmartTicks } from '../utils/display';
import { calculateCycleTime } from '../utils/cycleTime';
import { formatWorkDays, formatCalendarWeeks } from '../utils/formatting';

interface TimelineChartProps {
  data: IssueTimeline[];
  collapsedIds: string[];
  onToggleCollapse: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export function TimelineChart({ data, collapsedIds, onToggleCollapse, onExpandAll, onCollapseAll, onSave, onLoad }: TimelineChartProps) {
  // 1. Calculate Global Range
  const { minDate, maxDate, totalMinutes, earliestStart, latestEnd } = useMemo(() => {
    let min = new Date(8640000000000000); // Max possible date
    let max = new Date(0); // Epoch

    let hasData = false;

    data.forEach(issue => {
      issue.segments.forEach(seg => {
        hasData = true;
        if (seg.start < min) min = seg.start;
        if (seg.end > max) max = seg.end;
      });
    });

    // Capture Exact for Metrics
    const earliestStart = new Date(min);
    const latestEnd = new Date(max);

    if (!hasData) {
      min = new Date();
      max = addDays(new Date(), 1);
    }

    // Add a little buffer for display
    const displayMax = addDays(max, 1);

    const totalMinutes = differenceInMinutes(displayMax, min);
    return { minDate: min, maxDate: displayMax, totalMinutes, earliestStart, latestEnd };
  }, [data]);

  // Metric Calculations
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    // a) Cycle time
    const cycleTime = calculateCycleTime(earliestStart, latestEnd);

    // c) Longest Sub-task
    // User requested to explicitly EXCLUDE the parent (index 0).
    const children = data.slice(1);
    
    // If no children, we can't show sub-task metrics properly.
    // Fallback to null or empty objects? Or show "N/A"?
    // Let's use safely typed optional output.
    
    let longestItem = null;
    let lastItem = null;

    if (children.length > 0) {
      longestItem = children[0];
      let maxDuration = -1;

      children.forEach(item => {
          if (item.totalCycleTime > maxDuration) {
              maxDuration = item.totalCycleTime;
              longestItem = item;
          }
      });

      // d) Last sub-task
      lastItem = children[0];
      let maxEndDate = new Date(0);
      
      children.forEach(item => {
          const itemMax = item.segments.reduce((acc, seg) => seg.end > acc ? seg.end : acc, new Date(0));
          if (itemMax > maxEndDate) {
              maxEndDate = itemMax;
              lastItem = item;
          }
      });
    }

    return {
        cycleTime,
        longest: longestItem,
        last: lastItem
    };
  }, [data, earliestStart, latestEnd]);

  const getPosition = (date: Date) => {
    const minutesFromStart = differenceInMinutes(date, minDate);
    return (minutesFromStart / totalMinutes) * 100;
  };

  const getWidth = (start: Date, end: Date) => {
    const durationCurrent = differenceInMinutes(end, start);
    return (durationCurrent / totalMinutes) * 100;
  };

  // 2. Generate Ticks
  const ticks = useMemo(() => {
    return generateSmartTicks(minDate, maxDate);
  }, [minDate, maxDate]);

  const tickFormat = (date: Date) => {
     return format(date, 'MMM d');
  };


  
  // Better: Pre-calculate visibility map for O(1) lookup
  const visibilityMap = useMemo(() => {
    const visible = new Set<string>();
    const collapsedSet = new Set(collapsedIds);
    const itemMap = new Map(data.map(d => [d.key, d]));

    // We can iterate top-down if sorted by depth?
    // Or just iterate standard.
    // DFS order is usually: Parent, Child, Child.
    
    // Let's iterate the data array (which is in DFS order).
    for (const issue of data) {
        let isHidden = false;
        
        // Walk up parents
        let currentParam = issue.parentId;
        while (currentParam) {
            if (collapsedSet.has(currentParam)) {
                isHidden = true;
                break;
            }
            const parent = itemMap.get(currentParam);
            if (!parent) break; // Should not happen in consistent tree
            currentParam = parent.parentId;
        }
        
        if (!isHidden) visible.add(issue.key);
    }
    return visible;
  }, [data, collapsedIds]);


  return (
    <Paper withBorder p="md" mt="md" radius="md">
        <Grid gutter="xl">
            <Grid.Col span={9}>
                <Group justify="space-between" mb="md">
                    <Text fw={700} c="dimmed">{format(minDate, 'MMM d, yyyy')}</Text>
                    <Text fw={700} size="xl">Timeline</Text>
                    <Text fw={700} c="dimmed">{format(maxDate, 'MMM d, yyyy')}</Text>
                </Group>

                <ScrollArea>
                    <Box miw={600} pb="xl">
                    {/* Header Axis */}
                    <Box h={24} w="100%" bg="var(--mantine-color-gray-0)" mb="sm" style={{ position: 'relative', borderBottom: '1px solid #dee2e6' }}>
                        {ticks.map((date, i) => {
                            const pos = getPosition(date);
                            if (pos < 0 || pos > 100) return null;
                            
                            return (
                            <Box 
                                key={i} 
                                style={{ position: 'absolute', left: `${pos}%`, transform: 'translateX(-50%)', bottom: 0 }}
                            >
                                <Box h={6} w={1} bg="gray" mx="auto" />
                                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{tickFormat(date)}</Text>
                            </Box>
                            );
                        })}
                    </Box>

                    {data.map((issue) => {
                        if (!visibilityMap.has(issue.key)) return null;

                        const isCollapsed = collapsedIds.includes(issue.key);

                        return (
                        <Group key={issue.key} mb="xs" align="flex-start" gap="xs" wrap="nowrap">
                            {/* Column 1: Caret (Aligned with Bar Row) */}
                            <Box w={20} style={{ display: 'flex', flexDirection: 'column' }}>
                                {/* Spacer for Text Row */}
                                <Box h={24} mb={4} />
                                {/* Caret Container */}
                                <Box h={24} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {issue.hasChildren && (
                                        <UnstyledButton 
                                            onClick={() => onToggleCollapse(issue.key)}
                                            w={20} 
                                            h={20} 
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                transition: 'transform 0.2s ease',
                                                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
                                            }}
                                        >
                                            <Text size="sm" c="black" lh={1}>▶</Text>
                                        </UnstyledButton>
                                    )}
                                </Box>
                            </Box>

                            {/* Column 2: Content */}
                            <Box style={{ flex: 1 }}>
                                {/* Row 1: Label and Hierarchy Lines */}
                                <Group gap={0} mb={4} h={24} align="center" wrap="nowrap">
                                    {/* Indentation Lines */}
                                    {Array.from({ length: issue.depth }).map((_, i) => (
                                        <Box 
                                            key={i} 
                                            w={28} 
                                            h="100%" 
                                            style={{ 
                                                borderRight: '1px solid var(--mantine-color-gray-3)',
                                                opacity: 0.5 
                                            }} 
                                        />
                                    ))}
                                    
                                    {/* Label Content */}
                                    <Group gap="xs" pl="xs" h="100%" align="center" wrap="nowrap">
                                        <Anchor
                                            href={`https://jira.tandemdiabetes.com:8443/browse/${issue.key}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        fw={700} 
                                        size="sm" 
                                        w={90} 
                                        truncate
                                        c="blue"
                                    >
                                        {issue.key}
                                    </Anchor>
                                    <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>{issue.summary}</Text>
                                    </Group>
                                </Group>
                                
                                {/* Row 2: Timeline Track */}
                                <Box 
                                    w="100%" 
                                    h={24} 
                                    bg="var(--mantine-color-gray-1)" 
                                    style={{ position: 'relative', borderRadius: 4, overflow: 'hidden' }}
                                >
                                    {issue.segments.map((seg, i) => {
                                    const left = getPosition(seg.start);
                                    const width = getWidth(seg.start, seg.end);
                                    const color = getStatusColor(seg.status);
        
                                    return (
                                        <Tooltip 
                                        key={i} 
                                        label={`${seg.status}: ${format(seg.start, 'MMM d')} - ${format(seg.end, 'MMM d')} (${formatWorkDays(seg.durationDays)})`}
                                        withArrow
                                        >
                                        <Box
                                            bg={color}
                                            h="100%"
                                            style={{
                                            position: 'absolute',
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            minWidth: 2 // Ensure at least visible
                                            }}
                                        />
                                        </Tooltip>
                                    );
                                    })}
                                </Box>
                            </Box>
                        </Group>
                        );
                    })}
                    </Box>
                </ScrollArea>
            </Grid.Col>
            
            <Grid.Col span={3}>
                <Box mb="md">
                    <Stack gap="xs">
                        <Group gap="xs">
                            <Button size="xs" variant="light" onClick={onExpandAll} fullWidth style={{ flex: 1 }}>Expand All</Button>
                            <Button size="xs" variant="light" onClick={onCollapseAll} fullWidth style={{ flex: 1 }}>Collapse All</Button>
                        </Group>
                        <Group gap="xs">
                            <Button size="xs" variant="default" onClick={onSave} fullWidth style={{ flex: 1 }}>Save Settings</Button>
                            <Button size="xs" variant="default" onClick={onLoad} fullWidth style={{ flex: 1 }}>Load Settings</Button>
                        </Group>
                    </Stack>
                </Box>
                <Paper withBorder p="sm" bg="gray.0">
                    <Title order={4} mb="md">Summary</Title>
                    {metrics && (
                        <Stack gap="md">
                            <Box>
                                <Text size="sm" fw={700} c="dimmed" tt="uppercase">Cycle Time</Text>
                                <Text size="xl" fw={900} c="blue">{formatWorkDays(metrics.cycleTime)}</Text>
                            </Box>
                            
                            <Divider />

                             <Box>
                                <Text size="sm" fw={700} c="dimmed" tt="uppercase">Calendar Time</Text>
                                <Text size="xl" fw={900} c="blue">{formatCalendarWeeks(earliestStart, latestEnd)}</Text>
                                <Text size="xs" c="dimmed" mt={2}>
                                    {format(earliestStart, 'MMM d, yyyy')} - {format(latestEnd, 'MMM d, yyyy')}
                                </Text>
                            </Box>
                            
                            <Divider />

                            {metrics.longest && (
                            <Box>
                                <Text size="sm" fw={700} c="dimmed" tt="uppercase">Longest Sub-task</Text>
                                <Text size="xl" fw={900} c="blue">{formatWorkDays(metrics.longest.totalCycleTime)}</Text>
                                <Tooltip label={metrics.longest.summary}>
                                    <Text size="sm" fw={500} truncate>{metrics.longest.summary}</Text>
                                </Tooltip>
                                <Text size="xs" c="dimmed">({metrics.longest.key})</Text>
                            </Box>
                            )}

                            {metrics.longest && <Divider />}

                            {metrics.last && (
                            <Box>
                                <Text size="sm" fw={700} c="dimmed" tt="uppercase">Last Sub-task</Text>
                                <Text size="xl" fw={900} c="blue">{formatWorkDays(metrics.last.totalCycleTime)}</Text>
                                <Tooltip label={metrics.last.summary}>
                                    <Text size="sm" fw={500} truncate>{metrics.last.summary}</Text>
                                </Tooltip>
                                <Text size="xs" c="dimmed">({metrics.last.key})</Text>
                            </Box>
                            )}
                        </Stack>
                    )}
                </Paper>
            </Grid.Col>
        </Grid>
    </Paper>
  );
}
