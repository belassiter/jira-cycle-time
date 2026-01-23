import { useState } from 'react';
import { AppShell, Burger, Group, Text, TextInput, Button, Container, Title, Paper, Alert, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { processParentsAndChildren, IssueTimeline, filterTimelineStatuses, sortIssueTimelines } from './utils/transformers';
import { TimelineChart } from './components/TimelineChart';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const [issueId, setIssueId] = useState('CGM-3458');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<IssueTimeline[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePullData = async () => {
    if (!issueId) return;
    
    setLoading(true);
    setError(null);
    setTimelineData(null);

    try {
      const result = await window.ipcRenderer.getIssue(issueId);
      if (result.success) {
        // Transform the raw data immediately
        const timelines = processParentsAndChildren(result.data);
        const filtered = filterTimelineStatuses(timelines, ['To Do', 'Open', 'Backlog', 'Done', 'Resolved', 'Closed']);
        const sorted = sortIssueTimelines(filtered);
        setTimelineData(sorted);
      } else {
        setError(result.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with backend');
    } finally {
      setLoading(false);
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
            <Title order={2}>Pull Issue Data</Title>
            
            <Paper p="md" withBorder>
              <Group align="flex-end">
                <TextInput 
                  label="Jira Issue ID" 
                  placeholder="e.g. PROJ-123" 
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button onClick={handlePullData} loading={loading}>
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
              <TimelineChart data={timelineData} />
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
