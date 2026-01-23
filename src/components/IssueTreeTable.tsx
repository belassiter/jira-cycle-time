import { useMemo, useEffect } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef, type MRT_ExpandedState, type MRT_Updater } from 'mantine-react-table';
import { Box, Tooltip, Text, Group, Image } from '@mantine/core';
import { format } from 'date-fns';
import { IssueTimeline, getStatusColor } from '../utils/transformers';
import { generateSmartTicks } from '../utils/display';
import { formatWorkDays } from '../utils/formatting';
import { getTimelinePosition, getTimelineWidth } from '../utils/timelineLayout';

interface IssueTreeTableProps {
  data: IssueTimeline[]; // Expecting Nested Tree Data
  minDate: Date;
  maxDate: Date;
  totalMinutes: number;
  expanded: MRT_ExpandedState;
  onExpandedChange: (updater: MRT_Updater<MRT_ExpandedState>) => void;
}

export function IssueTreeTable({ data, minDate, maxDate, totalMinutes, expanded, onExpandedChange }: IssueTreeTableProps) {
  // Generate ticks for the header visualization
  const ticks = useMemo(() => {
    return generateSmartTicks(minDate, maxDate);
  }, [minDate, maxDate]);

  // Debug Logging for Timeline Alignment
  useEffect(() => {
     if (ticks.length > 0) {
         console.group('Timeline Alignment Debug');
         console.log('Global Range:', { minDate, maxDate, totalMinutes });
         console.log('Ticks Generated:', ticks.length);
         ticks.forEach((t, i) => {
             const pos = getTimelinePosition(t, minDate, totalMinutes);
             console.log(`Tick ${i}: ${format(t, 'yyyy-MM-dd')} -> ${pos.toFixed(2)}%`);
         });
         console.groupEnd();
     }
  }, [ticks, minDate, maxDate, totalMinutes]);

  const tickFormat = (date: Date) => {
     return format(date, 'MMM d');
  };

  const columns = useMemo<MRT_ColumnDef<IssueTimeline>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Key',
        // Variable width but tight:
        size: 150,      // Default starting width
        minSize: 80,    // Allow shrinking further
        maxSize: 400,
        enableResizing: true, 
        grow: false,    // Do not absorb extra space
        enableGlobalFilter: true,
        Cell: ({ row }) => (
            <Group gap="xs" wrap="nowrap" pl={row.depth * 20}>
                {/* Indentation only, no toggle button. The default expander column handles the toggle. */}
                {row.original.issueTypeIconUrl && (
                  <Image src={row.original.issueTypeIconUrl} w={16} h={16} fit="contain" />
                )}
                {row.original.url ? (
                  <Tooltip label={row.original.key} openDelay={500}>
                    <Text 
                        component="a" 
                        href={row.original.url} 
                        target="_blank"
                        fw={500} 
                        size="sm"
                        c="blue"
                        truncate
                        style={{ textDecoration: 'underline', cursor: 'pointer', display: 'block', maxWidth: '100%' }}
                    >
                        {row.original.key}
                    </Text>
                  </Tooltip>
                ) : (
                  <Tooltip label={row.original.key} openDelay={500}>
                    <Text fw={500} size="sm" truncate>{row.original.key}</Text>
                   </Tooltip>
                )}
            </Group>
        ),
      },
      {
        accessorKey: 'summary',
        header: 'Summary',
        size: 200, // Increased by 50px (was 150)
        enableResizing: false,
        grow: false,
        enableGlobalFilter: true,
        Cell: ({ cell }) => (
            <Tooltip label={cell.getValue<string>()} openDelay={500}>
                <Text size="sm" truncate>{cell.getValue<string>()}</Text>
            </Tooltip>
        )
      },
      {
        header: 'Timeline',
        accessorKey: 'key', // Dummy accessor
        id: 'timeline',
        size: 800, // Fixed large width
        minSize: 800, // Prevent compression
        maxSize: 800, // Prevent expansion
        grow: false, // Strict fixed width
        enableResizing: false, // Lock it down to simplify alignment debugging
        enableGlobalFilter: false,
        enableSorting: false, 
        enableColumnFilter: false, 
        enableColumnActions: false, 
        // STRICT ALIGNMENT: Zero padding in body
        mantineTableBodyCellProps: {
            style: { padding: 0, paddingLeft: 0, paddingRight: 0, borderRight: '1px solid #eee' },
        },
        mantineTableHeadCellProps: {
            style: { padding: 0, paddingLeft: 0, paddingRight: 0 },
        },
        // Use header context to size the box explicitly
        Header: ({ header }) => (
            <Box h={30} w={header.getSize()} style={{ position: 'relative', display: 'block', overflow: 'hidden' }}>
                {/* Render ticks absolutely. The container must have width. */}
                {ticks.map((date, i) => {
                    const pos = getTimelinePosition(date, minDate, totalMinutes);
                    // if (pos < -50 || pos > 150) return null; 
                    return (
                        <Box
                            key={i}
                            style={{ 
                                position: 'absolute', 
                                left: `${pos}%`, 
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center', // Align tick and text vertically
                            }}
                        >
                            <Box h={10} w={1} bg="gray" />
                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', fontSize: 10, paddingLeft: 4 }}>{tickFormat(date)}</Text>
                        </Box>
                    );
                })}
            </Box>
        ),
        Cell: ({ row }) => {
            const issue = row.original;
            return (
                <Box
                    w="100%"
                    h={24}
                    bg="var(--mantine-color-gray-1)"
                    style={{ position: 'relative', borderRadius: 0, overflow: 'hidden' }}
                >
                    {issue.segments.map((seg, i) => {
                        const left = getTimelinePosition(seg.start, minDate, totalMinutes);
                        const width = getTimelineWidth(seg.start, seg.end, totalMinutes);
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
                                        minWidth: 2
                                    }}
                                />
                            </Tooltip>
                        );
                    })}
                </Box>
            );
        }
      },
      {
        accessorKey: 'totalCycleTime',
        header: 'Cycle Time',
        size: 130, // Increased by 30px
        enableResizing: false,
        grow: false,
        Cell: ({ cell }) => <Text size="sm">{formatWorkDays(cell.getValue<number>())}</Text>
      }
    ],
    [ticks, minDate, totalMinutes]
  );


  const table = useMantineReactTable({
    columns,
    data,
    enableExpandAll: true,
    enableExpanding: true,
    getRowId: (row) => row.key,
    filterFromLeafRows: true, // Re-enable to allow searching children
    getSubRows: (row) => row.subRows,
    state: { expanded },
    onExpandedChange: onExpandedChange,
    displayColumnDefOptions: {
        'mrt-row-expand': {
            size: 40, 
        },
    },
    enableStickyHeader: true,
    mantinePaperProps: {
        style: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        },
    },
    mantineTableContainerProps: { 
        style: { 
            // height: '100%', // Handled by flex parent
            flex: 1,
            overflowY: 'auto' 
        } 
    }, 
    enablePagination: false, 
    enableBottomToolbar: false,
    enableTopToolbar: true,
    mantineExpandButtonProps: ({ row }) => ({
        style: {
          visibility: row.original.subRows && row.original.subRows.length > 0 ? 'visible' : 'hidden',
          transition: 'transform 0.2s',
          transform: row.getIsExpanded() ? 'rotate(-90deg)' : 'rotate(0deg)', // Custom rotation logic
        },
    }),
    initialState: { 
        density: 'xs', 
        showGlobalFilter: true
    },
    // Ensure standard global filter settings
    enableGlobalFilter: true,
    globalFilterFn: 'contains', 
    mantineTableHeadProps: {
        style: {
            position: 'sticky',
            top: 0,
            zIndex: 3,
            backgroundColor: 'white',
        }
    },
    mantineTableHeadRowProps: {
        style: {
            backgroundColor: 'white', 
        }
    },
    mantineTableHeadCellProps: {
        style: { 
          verticalAlign: 'bottom', 
          paddingRight: 4, 
          paddingLeft: 4,
          whiteSpace: 'nowrap',
          backgroundColor: 'white', // Hardcode white to be safe
          opacity: 1,
          zIndex: 4, 
        },
    },
    mantineTableProps: {
        highlightOnHover: true,
        withTableBorder: true,
        withColumnBorders: true,
        style: { tableLayout: 'fixed' }, // Enforce fixed layout
    },
    layoutMode: 'grid', // Enable grid mode for stricter sizing control
  });

  // Debug Logging
  console.log('[IssueTreeTable] Expanded State:', expanded);
  console.log('[IssueTreeTable] Visible Rows:', table.getRowModel().rows.map(r => `${r.id} (depth:${r.depth}, expanded:${r.getIsExpanded()})`));

  return <MantineReactTable table={table} />;
}
