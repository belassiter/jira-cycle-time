import { useMemo } from 'react';
import { Box, Tooltip, Group, Text, Image, Checkbox, Loader, Center } from '@mantine/core'; // Checkbox, Loader, Center added
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef, type MRT_ExpandedState, type MRT_Updater, type MRT_RowSelectionState } from 'mantine-react-table';
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
  rowSelection?: MRT_RowSelectionState;
  onRowSelectionChange?: (updater: MRT_Updater<MRT_RowSelectionState>) => void;
  isCalculating?: boolean;
}


export function IssueTreeTable({ 
    data, 
    minDate, 
    maxDate, 
    totalMinutes, 
    expanded, 
    onExpandedChange,
    rowSelection,
    onRowSelectionChange,
    isCalculating = false
}: IssueTreeTableProps) {
  // Generate ticks for the header visualization
  const ticks = useMemo(() => {
    return generateSmartTicks(minDate, maxDate);
  }, [minDate, maxDate]);

  const tickFormat = (date: Date) => {
     return format(date, 'MMM d');
  };

  // Inject Header as Root Row (Heirarchy Trick)
  const augmentedData = useMemo(() => {
      const rulerRow: IssueTimeline = {
          key: '__RULER__',
          summary: 'RULER',
          segments: [],
          totalCycleTime: 0,
          depth: 0,
          hasChildren: true,
          subRows: data, // Make actual data children of the Ruler so they sort independently
          issueTypeIconUrl: ''
      };
      
      return [rulerRow];
  }, [data]);

  const columns = useMemo<MRT_ColumnDef<IssueTimeline>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Key',
        // Variable width but tight:
        size: 120,      // Default starting width
        minSize: 80,    // Allow shrinking further
        maxSize: 400,
        enableResizing: true, 
        grow: false,    // Do not absorb extra space
        enableGlobalFilter: true,
        Cell: ({ row }) => {
            // RULER ROW: Display Header Title
            if (row.original.key === '__RULER__') {
                return <Text fw={700} size="sm">Key</Text>;
            }

            return (
                <Group gap="xs" wrap="nowrap" pl={Math.max(0, row.depth - 1) * 20}>
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
            );
        }
      },
      {
        accessorKey: 'summary',
        header: 'Summary',
        size: 200, // Increased by 50px (was 150)
        enableResizing: false,
        grow: false,
        enableGlobalFilter: true,
        Cell: ({ cell, row }) => {
            // RULER ROW: Display Header Title
            if (row.original.key === '__RULER__') {
                return <Text fw={700} size="sm">Summary</Text>;
            }
            return (
                <Tooltip label={cell.getValue<string>()} openDelay={500}>
                    <Text size="sm" truncate>{cell.getValue<string>()}</Text>
                </Tooltip>
            );
        }
      },
      {
        id: 'timeline',
        header: 'Timeline',
        // Using a dummy accessor key to avoid MRT using the first column's key by default if none provided
        accessorKey: 'timelineDummy', 
        minSize: 300, 
        grow: true, // Allow filling remaining space
        enableResizing: false, // Keep it fluid based on window size
        enableGlobalFilter: false,
        enableSorting: false, 
        enableColumnFilter: false, 
        enableColumnActions: false, 
        // STRICT ALIGNMENT: Zero padding in body
        mantineTableBodyCellProps: {
            style: { padding: 0, paddingLeft: 0, paddingRight: 0, borderRight: '1px solid #eee' },
        },
        mantineTableHeadCellProps: {
            // Force flex behavior inside the TH to allow child to grow
            sx: { 
                 '& .mantine-TableHeadCell-Content': { width: '100%', justifyContent: 'normal' },
                 '& .mantine-TableHeadCell-Content-Labels': { width: '100%' }
            },
            style: { padding: 0, paddingLeft: 0, paddingRight: 0, width: '100%' },
        },
        
        Header: () => null, // Hide actual header content 

        Cell: ({ row }) => {
            const issue = row.original;

            // RULER ROW: Render Ticks (Official Header Replacement)
            if (issue.key === '__RULER__') {
                 return (
                    <Box
                        w="100%"
                        h={30}
                        bg="white"
                        style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #eee' }}
                    >
                        {ticks.map((date, i) => {
                            const pos = getTimelinePosition(date, minDate, totalMinutes);
                            return (
                                <Box
                                    key={i}
                                    style={{ 
                                        position: 'absolute', 
                                        left: `${pos}%`, 
                                        top: 0, 
                                        height: 30,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start', // Left align content relative to the pos anchor
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <Box h={8} w={1} bg="black" mb={2} />
                                    {/* Text right of the tick mark */}
                                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', fontSize: 10, paddingLeft: 2 }}>{tickFormat(date)}</Text>
                                </Box>
                            );
                        })}
                    </Box>
                 );
            }

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
        size: 80, 
        enableResizing: false,
        grow: false,
        Cell: ({ cell, row }) => {
             // RULER ROW: Display Header Title
             if (row.original.key === '__RULER__') {
                return <Text fw={700} size="sm">Cycle Time</Text>;
            }
            return <Text size="sm">{formatWorkDays(cell.getValue<number>())}</Text>;
        }
      }
    ],
    [ticks, minDate, totalMinutes] // Dependencies updated
  );


  const table = useMantineReactTable({
    columns,
    data: augmentedData,
    enableTableHead: false, 
    // enableRowPinning: false, // Removed per request
    enableExpandAll: true,
    enableExpanding: true,
    getRowId: (row) => row.key,
    filterFromLeafRows: true, // Re-enable to allow searching children
    getSubRows: (row) => row.subRows,
    displayColumnDefOptions: {
        'mrt-row-expand': {
            size: 40,
        },
        'mrt-row-select': {
            size: 40,
            Header: '', // Hide header checkbox
            Cell: ({ row }) => {
                // HIDE for Ruler Row
                if (row.original.key === '__RULER__') return null;

                const isSelected = row.getIsSelected();
                // Show loader only if this specific row is selected AND we are calculating
                if (isSelected && isCalculating) {
                   return (
                     <Center>
                        <Loader size={16} /> 
                     </Center>
                   );
                }
                return (
                    <Center>
                         <Checkbox 
                            checked={isSelected}
                            onChange={row.getToggleSelectedHandler()}
                            aria-label={`Select ${row.original.key}`}
                         />
                    </Center>
                );
            }
        }
    },
    // enableStickyHeader: false, // Removed to allow Ruler row to scroll normally
    mantinePaperProps: {
        style: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        },
    },
    mantineTableBodyCellProps: {
        style: {
            paddingTop: 4, 
            paddingBottom: 4
        }
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
    enableRowSelection: true,
    enableMultiRowSelection: true,
    enableSelectAll: false,
    enableSorting: true, 
    onRowSelectionChange: onRowSelectionChange,
    
    // Handlers defined above in destructured props are passed automatically if keys match, 
    // but explicit assignment is safer if we are overriding or grouping.
    // However, we must ensure we don't have duplicates in the object literal passed to useMantineReactTable (or the component).
    // The previous error was because 'onExpandedChange' and 'state' were defined twice in the big object.
    // Let's clean this up.

    onExpandedChange,
    state: {
        expanded,
        rowSelection,
    },
    
    mantineExpandButtonProps: ({ row }) => {
        // HIDE for Ruler Row
        if (row.original.key === '__RULER__') {
             return { style: { visibility: 'hidden', display: 'none' } };
        }
        return {
            style: {
              visibility: row.getCanExpand() ? 'visible' : 'hidden', 
              transition: 'transform 0.2s',
              transform: row.getIsExpanded() ? 'rotate(0deg)' : 'rotate(-90deg)', // Standard: Down (0) when expanded, Right (-90) when collapsed
            },
        };
    },
    mantineTableBodyRowProps: ({ row }) => ({
        style: {
            backgroundColor: row.getIsSelected() ? 'var(--mantine-color-blue-0)' : undefined, // Light blue highlight
        }
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
        style: { tableLayout: 'fixed', width: '100%' }, // Force full width and fixed layout
    },
    layoutMode: 'grid', // Revert to semantic table to fill space better
  });

  return <MantineReactTable table={table} />;
}
