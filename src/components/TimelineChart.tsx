import { useMemo } from 'react';
import { Box, Tooltip, Text, Group, ScrollArea, Paper } from '@mantine/core';
import { differenceInMinutes, format, addDays } from 'date-fns';
import { IssueTimeline, getStatusColor } from '../utils/transformers';

interface TimelineChartProps {
  data: IssueTimeline[];
}

export function TimelineChart({ data }: TimelineChartProps) {
  // 1. Calculate Global Range
  const { minDate, maxDate, totalMinutes } = useMemo(() => {
    let min = new Date();
    let max = new Date(0); // Epoch

    data.forEach(issue => {
      issue.segments.forEach(seg => {
        if (seg.start < min) min = seg.start;
        if (seg.end > max) max = seg.end;
      });
    });

    // Add a little buffer
    max = addDays(max, 1);

    const totalMinutes = differenceInMinutes(max, min);
    return { minDate: min, maxDate: max, totalMinutes };
  }, [data]);

  const getPosition = (date: Date) => {
    const minutesFromStart = differenceInMinutes(date, minDate);
    return (minutesFromStart / totalMinutes) * 100;
  };

  const getWidth = (start: Date, end: Date) => {
    const durationCurrent = differenceInMinutes(end, start);
    return (durationCurrent / totalMinutes) * 100;
  };

  return (
    <Paper withBorder p="md" mt="md" radius="md">
      <Group justify="space-between" mb="md">
        <Text fw={700} c="dimmed">{format(minDate, 'MMM d, yyyy')}</Text>
        <Text fw={700} size="xl">Cycle Time Timeline</Text>
        <Text fw={700} c="dimmed">{format(maxDate, 'MMM d, yyyy')}</Text>
      </Group>

      <ScrollArea>
        <Box miw={800} pb="xl">
          {/* Header Axis (Rough) */}
          <Box h={20} w="100%" bg="var(--mantine-color-gray-1)" mb="sm" style={{ position: 'relative' }}>
             {/* We could render ticks here later */}
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
                      label={`${seg.status}: ${format(seg.start, 'MMM d')} - ${format(seg.end, 'MMM d')} (${seg.durationDays} days)`}
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
    </Paper>
  );
}
