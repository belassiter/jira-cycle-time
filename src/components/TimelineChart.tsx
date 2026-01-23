import { useMemo } from 'react';
import { Box, Tooltip, Text, Group, ScrollArea, Paper, Grid, Stack, Title, Divider } from '@mantine/core';
import { differenceInMinutes, format, addDays } from 'date-fns';
import { IssueTimeline, getStatusColor } from '../utils/transformers';
import { generateMondayTicks } from '../utils/display';
import { calculateCycleTime } from '../utils/cycleTime';
import { formatWorkDays } from '../utils/formatting';

interface TimelineChartProps {
  data: IssueTimeline[];
}

export function TimelineChart({ data }: TimelineChartProps) {
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
    return generateMondayTicks(minDate, maxDate);
  }, [minDate, maxDate]);

  const tickFormat = (date: Date) => {
     return format(date, 'MMM d');
  };

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

                    {data.map((issue) => (
                        <Box key={issue.key} mb="xs">
                        <Group gap="xs" mb={4}>
                            <Text fw={700} size="sm" w={100} truncate>{issue.key}</Text>
                            <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>{issue.summary}</Text>
                        </Group>
                        
                        {/* Timeline Track */}
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
                    ))}
                    </Box>
                </ScrollArea>
            </Grid.Col>
            
            <Grid.Col span={3}>
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
                                <Text size="sm">{format(earliestStart, 'MMM d, yyyy')}</Text>
                                <Text size="xs" c="dimmed">to</Text>
                                <Text size="sm">{format(latestEnd, 'MMM d, yyyy')}</Text>
                            </Box>
                            
                            <Divider />

                            {metrics.longest && (
                            <Box>
                                <Text size="sm" fw={700} c="dimmed" tt="uppercase">Longest Sub-task</Text>
                                <Tooltip label={metrics.longest.summary}>
                                    <Text size="sm" fw={500} truncate>{metrics.longest.summary}</Text>
                                </Tooltip>
                                <Text size="xs" c="dimmed">({metrics.longest.key})</Text>
                                <Text size="md" fw={700} mt={4}>{formatWorkDays(metrics.longest.totalCycleTime)}</Text>
                            </Box>
                            )}

                            {metrics.longest && <Divider />}

                            {metrics.last && (
                            <Box>
                                <Text size="sm" fw={700} c="dimmed" tt="uppercase">Last Sub-task</Text>
                                <Tooltip label={metrics.last.summary}>
                                    <Text size="sm" fw={500} truncate>{metrics.last.summary}</Text>
                                </Tooltip>
                                <Text size="xs" c="dimmed">({metrics.last.key})</Text>
                                <Text size="md" fw={700} mt={4}>{formatWorkDays(metrics.last.totalCycleTime)}</Text>
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
