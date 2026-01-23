import { useState } from 'react';
import { AppShell, Burger, Group, Text, TextInput, Button, Container, Paper, Alert, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { processParentsAndChildren, IssueTimeline, filterTimelineStatuses } from './utils/transformers';
import { TimelineChart } from './components/TimelineChart';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [issueId, setIssueId] = useState('CGM-3458');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<IssueTimeline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]); // Array of IDs that are COLLAPSED

  const handlePullData = async (targetId: string = issueId) => {
    if (!targetId) return;
    
    setLoading(true);
    setError(null);
    setTimelineData(null);

    try {
      const result = await window.ipcRenderer.getIssue(targetId);
      if (result.success) {
        // Transform the raw data immediately
        // processParentsAndChildren now performs the topological sort (DFS flattening)
        const timelines = processParentsAndChildren(result.data);
        // Filtering might break the tree if we remove parents but keep children?
        // Ideally, filtering should happen inside the transformer or be aware of hierarchy.
        // For now, let's filter. If a parent is filtered out, the child might look orphaned visually but 'depth' is static.
        const filtered = filterTimelineStatuses(timelines, ['To Do', 'Open', 'Backlog', 'Done', 'Resolved', 'Closed']);
        
        // REMOVED: sortIssueTimelines(filtered) - this was destroying the DFS tree order
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

  const handleSaveSettings = () => {
    const settings = {
        issueId,
        collapsedIds
    };
    localStorage.setItem('jira-cycle-time-settings', JSON.stringify(settings));
    alert('Settings saved!');
  };

  const handleLoadSettings = () => {
    const saved = localStorage.getItem('jira-cycle-time-settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.issueId) {
                setIssueId(settings.issueId);
                handlePullData(settings.issueId);
            }
            if (Array.isArray(settings.collapsedIds)) {
                setCollapsedIds(settings.collapsedIds);
            }
        } catch (e) {
            console.error("Failed to parse settings", e);
            alert('Failed to load settings.');
        }
    } else {
        alert('No saved settings found.');
    }
  };

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

      <AppShell.Main>
        <Container size="md">
          <Stack>
            
            <Paper p="md" withBorder>
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
            </Paper>

            {error && (
              <Alert color="red" title="Error">
                {error}
              </Alert>
            )}

            {timelineData && (
              <TimelineChart 
                data={timelineData} 
                collapsedIds={collapsedIds}
                onToggleCollapse={(id) => {
                    setCollapsedIds(prev => 
                        prev.includes(id) 
                            ? prev.filter(x => x !== id) 
                            : [...prev, id]
                    );
                }}
                onExpandAll={() => setCollapsedIds([])}
                onCollapseAll={() => {
                    // Collapse all items that have children
                    const allAndParents = timelineData
                        .filter(item => item.hasChildren)
                        .map(item => item.key);
                    setCollapsedIds(allAndParents);
                }}
                onSave={handleSaveSettings}
                onLoad={handleLoadSettings}
              />
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
