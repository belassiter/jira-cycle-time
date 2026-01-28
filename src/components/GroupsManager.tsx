import { ActionIcon, Button, Group, Stack, Text, TextInput, Paper, ScrollArea, Badge, Grid, Table, ThemeIcon, Tooltip } from '@mantine/core';
import { SubTaskGroup, groupSubTasks, classifySubTask, OTHER_GROUP_ID } from '../utils/grouping';
import { IssueTimeline } from '../utils/transformers';
import { IconTrash, IconArrowUp, IconArrowDown, IconPlus, IconCheck } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

interface GroupsManagerProps {
    groups: SubTaskGroup[];
    onChange: (groups: SubTaskGroup[]) => void;
    allSubTasks?: IssueTimeline[];
    excludedStatuses?: string[];
    onExcludedChange?: (statuses: string[]) => void;
    allStatuses?: string[];
    statusCounts?: Record<string, number>;
    excludedIssueTypes?: string[];
    onExcludedIssueTypesChange?: (types: string[]) => void;
    allIssueTypes?: string[];
    issueTypeCounts?: Record<string, number>;
}

export function GroupsManager({ 
    groups, 
    onChange, 
    allSubTasks = [],
    excludedStatuses = [],
    onExcludedChange,
    allStatuses = [],
    statusCounts = {},
    excludedIssueTypes = [],
    onExcludedIssueTypesChange,
    allIssueTypes = [],
    issueTypeCounts = {}
}: GroupsManagerProps) {
    const [manualStatus, setManualStatus] = useState('');
    const [manualIssueType, setManualIssueType] = useState('');

    // Merge known statuses with any custom excluded ones not seen in data
    // Case-insensitive normalization
    const displayedStatuses = useMemo(() => {
        const uniqueNorm = new Set<string>();
        const mapToDisplay: Record<string, string> = {};

        allStatuses.forEach(s => {
            const key = s.trim().toLowerCase();
            uniqueNorm.add(key);
            if (!mapToDisplay[key]) mapToDisplay[key] = s.trim();
        });

        excludedStatuses.forEach(s => {
            const key = s.trim().toLowerCase();
            uniqueNorm.add(key);
            if (!mapToDisplay[key]) mapToDisplay[key] = s.trim();
        });

        return Array.from(uniqueNorm)
            .sort((a, b) => a.localeCompare(b))
            .map(key => mapToDisplay[key]);
    }, [allStatuses, excludedStatuses]);

    const displayedIssueTypes = useMemo(() => {
        const uniqueNorm = new Set<string>();
        const mapToDisplay: Record<string, string> = {};

        allIssueTypes.forEach(s => {
            const key = s.trim().toLowerCase();
            uniqueNorm.add(key);
            if (!mapToDisplay[key]) mapToDisplay[key] = s.trim();
        });

        excludedIssueTypes.forEach(s => {
            const key = s.trim().toLowerCase();
            uniqueNorm.add(key);
            if (!mapToDisplay[key]) mapToDisplay[key] = s.trim();
        });

        return Array.from(uniqueNorm)
            .sort((a, b) => a.localeCompare(b))
            .map(key => mapToDisplay[key]);
    }, [allIssueTypes, excludedIssueTypes]);

    const handleStatusToggle = (status: string) => {
        if (!onExcludedChange) return;
        const statusLower = status.trim().toLowerCase();
        const isExcluded = excludedStatuses.some(s => s.trim().toLowerCase() === statusLower);

        if (isExcluded) {
            onExcludedChange(excludedStatuses.filter(s => s.trim().toLowerCase() !== statusLower));
        } else {
            onExcludedChange([...excludedStatuses, status.trim()]);
        }
    };

    const handleIssueTypeToggle = (type: string) => {
        if (!onExcludedIssueTypesChange) return;
        const typeLower = type.trim().toLowerCase();
        const isExcluded = excludedIssueTypes.some(s => s.trim().toLowerCase() === typeLower);

        if (isExcluded) {
            onExcludedIssueTypesChange(excludedIssueTypes.filter(s => s.trim().toLowerCase() !== typeLower));
        } else {
            onExcludedIssueTypesChange([...excludedIssueTypes, type.trim()]);
        }
    };

    const handleAddManualStatus = () => {
        if (!manualStatus.trim() || !onExcludedChange) return;
        const newStatuses = manualStatus.split(',').map(s => s.trim()).filter(s => s);
        
        const next = [...excludedStatuses];
        newStatuses.forEach(s => {
            const sLower = s.toLowerCase();
            if (!next.some(existing => existing.toLowerCase() === sLower)) {
                next.push(s);
            }
        });
        
        onExcludedChange(next);
        setManualStatus('');
    };

    const handleAddManualIssueType = () => {
        if (!manualIssueType.trim() || !onExcludedIssueTypesChange) return;
        const newTypes = manualIssueType.split(',').map(s => s.trim()).filter(s => s);
        
        const next = [...excludedIssueTypes];
        newTypes.forEach(s => {
            const sLower = s.toLowerCase();
            if (!next.some(existing => existing.toLowerCase() === sLower)) {
                next.push(s);
            }
        });
        
        onExcludedIssueTypesChange(next);
        setManualIssueType('');
    };
    
    // Calculate counts and unallocated tasks real-time
    const { counts, summaryCounts } = useMemo(() => {
        const grouped = groupSubTasks(allSubTasks, groups);
        const c: Record<string, number> = {};
        groups.forEach(g => {
            c[g.id] = grouped[g.id]?.length || 0;
        });
        
        // Summary Counts (Frequency)
        const sCounts: Record<string, number> = {};
        allSubTasks.forEach(t => {
            const s = t.summary.trim();
            sCounts[s] = (sCounts[s] || 0) + 1;
        });
        
        const summaryList = Object.entries(sCounts)
            .sort((a, b) => b[1] - a[1]) // Sort by frequency desc
            .map(([summary, count]) => ({ summary, count }));

        return { counts: c, summaryCounts: summaryList };
    }, [groups, allSubTasks]);

    const handleAdd = () => {
        const newGroup: SubTaskGroup = {
            id: crypto.randomUUID(),
            name: 'New Group',
            keywords: []
        };
        onChange([...groups, newGroup]);
    };

    const handleUpdate = (id: string, field: keyof SubTaskGroup, value: any) => {
        const updated = groups.map(g => {
            if (g.id === id) {
                if (field === 'keywords') {
                    // Expecting comma separated string
                    const keys = (value as string).split(',').map(k => k.trim()).filter(k => k.length > 0);
                    return { ...g, keywords: keys };
                }
                return { ...g, [field]: value };
            }
            return g;
        });
        onChange(updated);
    };

    const handleDelete = (id: string) => {
        onChange(groups.filter(g => g.id !== id));
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === groups.length - 1) return;
        
        const newGroups = [...groups];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        
        [newGroups[index], newGroups[swapIndex]] = [newGroups[swapIndex], newGroups[index]];
        onChange(newGroups);
    };

    return (
        <Grid gutter="xl" style={{ flex: 1, minHeight: 0 }}>
            {/* Column 1: Status Exclusion */}
            <Grid.Col span={3} style={{ borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
                <Stack style={{ flex: 1, minHeight: 0 }}>
                    <Text size="sm" fw={500}>Status Exclusion</Text>
                    
                    <Group gap="xs">
                        <TextInput 
                            placeholder="Add statuses..." 
                            size="xs" 
                            style={{ flex: 1 }}
                            value={manualStatus}
                            onChange={(e) => setManualStatus(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddManualStatus()}
                        />
                        <ActionIcon variant="light" onClick={handleAddManualStatus}>
                            <IconPlus size={16} />
                        </ActionIcon>
                    </Group>

                    <ScrollArea h="100%" offsetScrollbars style={{ flex: 1 }}>
                        <Table striped style={{ fontSize: 11 }} highlightOnHover>
                             <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Issues</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {displayedStatuses.map((status) => {
                                    const isExcluded = excludedStatuses.some(s => s.trim().toLowerCase() === status.trim().toLowerCase());
                                    const count = statusCounts[status] || 0;
                                    return (
                                        <Table.Tr 
                                            key={status} 
                                            bg={isExcluded ? 'gray.2' : 'white'} 
                                            style={{ cursor: 'pointer', opacity: isExcluded ? 0.7 : 1 }}
                                            onClick={() => handleStatusToggle(status)}
                                        >
                                            <Table.Td>
                                                <Text size="xs" td={isExcluded ? 'line-through' : undefined}>{status}</Text>
                                            </Table.Td>
                                            <Table.Td style={{ textAlign: 'right' }}>
                                                <Text size="xs" c="dimmed">{count}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Stack>
            </Grid.Col>

            {/* Column 2: Issue Type Exclusion */}
            <Grid.Col span={3} style={{ borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
                <Stack style={{ flex: 1, minHeight: 0 }}>
                    <Text size="sm" fw={500}>Issue Type Exclusion</Text>
                    
                    <Group gap="xs">
                        <TextInput 
                            placeholder="Add types..." 
                            size="xs" 
                            style={{ flex: 1 }}
                            value={manualIssueType}
                            onChange={(e) => setManualIssueType(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddManualIssueType()}
                        />
                        <ActionIcon variant="light" onClick={handleAddManualIssueType}>
                            <IconPlus size={16} />
                        </ActionIcon>
                    </Group>

                    <ScrollArea h="100%" offsetScrollbars style={{ flex: 1 }}>
                        <Table striped style={{ fontSize: 11 }} highlightOnHover>
                             <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>Issues</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {displayedIssueTypes.map((type) => {
                                    const isExcluded = excludedIssueTypes.some(s => s.trim().toLowerCase() === type.trim().toLowerCase());
                                    const count = issueTypeCounts[type] || 0;
                                    return (
                                        <Table.Tr 
                                            key={type} 
                                            bg={isExcluded ? 'gray.2' : 'white'} 
                                            style={{ cursor: 'pointer', opacity: isExcluded ? 0.7 : 1 }}
                                            onClick={() => handleIssueTypeToggle(type)}
                                        >
                                            <Table.Td>
                                                <Text size="xs" td={isExcluded ? 'line-through' : undefined}>{type}</Text>
                                            </Table.Td>
                                            <Table.Td style={{ textAlign: 'right' }}>
                                                <Text size="xs" c="dimmed">{count}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Stack>
            </Grid.Col>

            {/* Column 3: Sub-task Groups */}
            <Grid.Col span={3} style={{ borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
                <Stack style={{ flex: 1, minHeight: 0 }}>
                    <Text size="sm" fw={500}>Sub-task Groups</Text>
                    
                    <ScrollArea h="100%" offsetScrollbars style={{ flex: 1 }}>
                    <Stack gap="xs">
                        {groups.map((group, index) => (
                        <Paper key={group.id} withBorder p="sm">
                            <Group align="flex-start">
                                <Stack gap="xs" style={{ flex: 1 }}>
                                    <Group justify="space-between">
                                        <TextInput 
                                                placeholder="Group Name"
                                                size="xs"
                                                style={{ flex: 1 }}
                                                value={group.name} 
                                                onChange={(e) => handleUpdate(group.id, 'name', e.target.value)}
                                        />
                                        <Badge variant="light" color="gray">{counts[group.id] || 0}</Badge>
                                    </Group>
                                    <TextInput 
                                            placeholder="Keywords (e.g. dev, api, *test)"
                                            size="xs"
                                            value={group.keywords.join(', ')} 
                                            onChange={(e) => handleUpdate(group.id, 'keywords', e.target.value)}
                                    />
                                </Stack>
                                
                                <Stack gap={4} mt={4}>
                                        <ActionIcon variant="light" size="xs" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                                            <IconArrowUp size={12} />
                                        </ActionIcon>
                                        <ActionIcon variant="light" size="xs" onClick={() => handleMove(index, 'down')} disabled={index === groups.length - 1}>
                                            <IconArrowDown size={12} />
                                        </ActionIcon>
                                        <ActionIcon color="red" variant="subtle" size="xs" onClick={() => handleDelete(group.id)}>
                                            <IconTrash size={12} />
                                        </ActionIcon>
                                </Stack>
                            </Group>
                        </Paper> 
                        ))}
                    </Stack>
                    </ScrollArea>

                    <Button leftSection={<IconPlus size={16}/>} variant="outline" onClick={handleAdd}>
                        Add Group
                    </Button>
                </Stack>
            </Grid.Col>
            
            {/* Column 4: Sub-task Group Assignments */}
            <Grid.Col span={3} style={{ display: 'flex', flexDirection: 'column' }}>
                <Stack style={{ flex: 1, minHeight: 0 }}>
                     <Text size="sm" fw={500}>Sub-task Group Assignments</Text>
                     <ScrollArea h="100%" offsetScrollbars style={{ flex: 1 }}>
                        <Table striped style={{ fontSize: 11 }}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Summary</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>#</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {summaryCounts.map((item, i) => {
                                    const groupId = classifySubTask(item.summary, groups);
                                    const group = groups.find(g => g.id === groupId);
                                    const isIncluded = groupId !== OTHER_GROUP_ID;
                                    return (
                                        <Table.Tr key={i} bg={isIncluded ? 'gray.1' : 'white'}>
                                            <Table.Td style={{ fontSize: 11, maxWidth: 150 }}>
                                                <Tooltip label={isIncluded ? `Assigned to: ${group?.name}` : 'Not assigned'} position="top-start" multiline w={220}>
                                                  <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
                                                    {isIncluded && <ThemeIcon size={12} color="green" variant="transparent"><IconCheck size={12}/></ThemeIcon>}
                                                    <Text size="xs" span truncate>{item.summary}</Text>
                                                  </Group>
                                                </Tooltip>
                                            </Table.Td>
                                            <Table.Td style={{ fontSize: 11, textAlign: 'right' }}>{item.count}</Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                     </ScrollArea>
                </Stack>
            </Grid.Col>
        </Grid>
    );
}
