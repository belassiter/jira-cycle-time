import { describe, it, expect } from 'vitest';
import { processIssueTimeline } from './transformers';

describe('Hyperlink Logic', () => {
    it('should pass through the URL field if present in the input', () => {
        const input = {
            key: 'TEST-123',
            url: 'https://jira.example.com/browse/TEST-123',
            fields: {
                summary: 'Test Summary',
                created: '2023-01-01T10:00:00.000Z',
                status: { name: 'To Do' },
                issuetype: { name: 'Story' }
            }
        };

        const result = processIssueTimeline(input);

        expect(result.key).toBe('TEST-123');
        expect(result.url).toBe('https://jira.example.com/browse/TEST-123');
    });

    it('should verify URL is structured correctly from backend-like data', () => {
         // Simulating the object shape returned by electron/main.ts
         const backendData = {
            key: 'PROJ-1',
            url: 'https://myjira.com/browse/PROJ-1',
            summary: 'My Project',
            created: '2023-01-01',
            status: 'In Progress',
            issueType: 'Epic',
            changelog: { histories: [] }
         };

         // processIssueTimeline handles both raw Jira objects AND the cleaned objects from main.ts
         // because we made it robust in previous steps.
         const result = processIssueTimeline(backendData);
         expect(result.url).toBeDefined();
         expect(result.url).toContain('https://myjira.com/browse/PROJ-1');
    });
});
