import { ActionIcon, Button, Group, Stack, Text, TextInput, Paper, ScrollArea, Badge, Grid, Table, ThemeIcon } from '@mantine/core';
import { SubTaskGroup, groupSubTasks, classifySubTask, OTHER_GROUP_ID } from '../utils/grouping';
import { IssueTimeline } from '../utils/transformers';
import { IconTrash, IconArrowUp, IconArrowDown, IconPlus, IconCheck } from '@tabler/icons-react';
import { useMemo } from 'react';

interface GroupsManagerProps {
    groups: SubTaskGroup[];
    onChange: (groups: SubTaskGroup[]) => void;
    allSubTasks?: IssueTimeline[];
}

export function GroupsManager({ groups, onChange, allSubTasks = [] }: GroupsManagerProps) {
    
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
        <Grid>
            <Grid.Col span={7} style={{ borderRight: '1px solid #eee' }}>
                <Stack>
                    <Text size="sm" c="dimmed">
                        Define groups for sub-tasks based on finding keywords in the Summary. 
                        Groups are processed in order. First match wins.
                    </Text>
                    
                    <ScrollArea h={500} offsetScrollbars>
                    <Stack gap="xs">
                        {groups.map((group, index) => (
                        <Paper key={group.id} withBorder p="sm">
                            <Group align="flex-start">
                                <Stack gap="xs" style={{ flex: 1 }}>
                                    <Group justify="space-between">
                                        <TextInput 
                                                // label="Group Name" 
                                                placeholder="Group Name"
                                                size="xs"
                                                style={{ flex: 1 }}
                                                value={group.name} 
                                                onChange={(e) => handleUpdate(group.id, 'name', e.target.value)}
                                        />
                                        <Badge variant="light" color="gray">{counts[group.id] || 0}</Badge>
                                    </Group>
                                    <TextInput 
                                            // label="Keywords" 
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
            
            <Grid.Col span={5}>
                <Stack>
                     <Text size="sm" fw={500}>Available Sub-tasks</Text>
                     <ScrollArea h={550}>
                        <Table striped style={{ fontSize: 11 }}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Summary</Table.Th>
                                    <Table.Th>Count</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {summaryCounts.map((item, i) => {
                                    const groupId = classifySubTask(item.summary, groups);
                                    const isIncluded = groupId !== OTHER_GROUP_ID;
                                    return (
                                        <Table.Tr key={i} bg={isIncluded ? 'gray.1' : undefined}>
                                            <Table.Td style={{ wordBreak: 'break-word', fontSize: 11 }}>
                                                <Group gap="xs" wrap="nowrap">
                                                    {isIncluded && <ThemeIcon size={12} color="green" variant="transparent"><IconCheck size={12}/></ThemeIcon>}
                                                    <Text size="xs" span>{item.summary}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td style={{ fontSize: 11 }}>{item.count}</Table.Td>
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
