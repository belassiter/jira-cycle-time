import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import axios from 'axios'

// --- Jira API Handling ---

interface JiraSecrets {
  host: string;
  email?: string;
  apiToken: string;
}

// Cache for field IDs to avoid fetching them every time
let fieldMapCache: { epicLink?: string; parentLink?: string } | null = null;

function getSecrets(): JiraSecrets {
  const userDataPath = path.join(app.getPath('userData'), 'jira-secrets.json');
  // Fallback 1: Relative to __dirname (useful for some builds)
  const localSecretsPath = path.join(__dirname, '../../jira-secrets.json');
  // Fallback 2: Relative to CWD (useful for dev: npm run dev)
  const cwdSecretsPath = path.join(process.cwd(), 'jira-secrets.json');
      
  if (fs.existsSync(userDataPath)) {
    return JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));
  }
  if (fs.existsSync(cwdSecretsPath)) {
    return JSON.parse(fs.readFileSync(cwdSecretsPath, 'utf-8'));
  }
  if (fs.existsSync(localSecretsPath)) {
    return JSON.parse(fs.readFileSync(localSecretsPath, 'utf-8'));
  }

  throw new Error(`Secrets file not found. Checked: \n1. ${userDataPath}\n2. ${cwdSecretsPath}`);
}

async function getFieldIds(secrets: JiraSecrets) {
  if (fieldMapCache) return fieldMapCache;

  const authHeader = secrets.email 
    ? `Basic ${Buffer.from(`${secrets.email}:${secrets.apiToken}`).toString('base64')}`
    : `Bearer ${secrets.apiToken}`;
  const host = secrets.host.replace(/^https?:\/\//, '');

  try {
    const response = await axios.get(`https://${host}/rest/api/2/field`, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });

    const fields = response.data;
    fieldMapCache = {
      epicLink: fields.find((f: any) => f.name === 'Epic Link')?.id,
      parentLink: fields.find((f: any) => f.name === 'Parent Link')?.id, // Advanced Roadmaps
    };
    return fieldMapCache;
  } catch (error) {
    console.error("Failed to fetch fields:", error);
    return {};
  }
}

async function searchJiraIssues(jql: string, secrets: JiraSecrets) {
    const authHeader = secrets.email 
      ? `Basic ${Buffer.from(`${secrets.email}:${secrets.apiToken}`).toString('base64')}`
      : `Bearer ${secrets.apiToken}`;
    const host = secrets.host.replace(/^https?:\/\//, '');
  
    // We need to fetch enough fields to reconstruct the hierarchy
    // history is in 'changelog'
    console.log(`JIRA-SEARCH: ${jql}`);

    const response = await axios.get(`https://${host}/rest/api/2/search`, {
      params: { 
        jql, 
        expand: 'changelog',
        maxResults: 500, // Reasonable limit for now
        fields: ['summary', 'status', 'issuetype', 'parent', 'created', '*all'] // *all to ensure we get custom fields
      },
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    return response.data.issues;
}

ipcMain.handle('jira-get-issue', async (_event, issueId: string) => {
  try {
    const secrets = getSecrets();
    const fieldIds = await getFieldIds(secrets);

    // 1. Fetch ONLY the root issue first to validate type
    // This prevents massive queries for Themes/Initiatives
    const rootJql = `key = "${issueId}"`;
    const rootResults = await searchJiraIssues(rootJql, secrets);
    
    if (rootResults.length === 0) {
        return { success: false, error: `Issue ${issueId} not found.` };
    }

    const rootIssue = rootResults[0];
    const typeName = rootIssue.fields.issuetype?.name;
    
    // Explicitly block high-level types
    if (typeName === 'Initiative' || typeName === 'Theme') {
            return { 
            success: false, 
            error: 'Hierarchy levels above Epic are currently not supported.' 
        };
    }

    // 2. If valid, fetch hierarchy
    // (We could reuse rootResults, but fetching everything in one go is easier for the "OR" logic)
    const jql = `key = "${issueId}" OR issue in childIssuesOf("${issueId}")`;
    const issues = await searchJiraIssues(jql, secrets);

    // 3. Map to a clean format for frontend
    const cleanHost = secrets.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const cleanData = issues.map((issue: any) => {
      let parentKey = issue.fields.parent?.key;
      
      // If no standard parent, check Epic Link or Parent Link
      if (!parentKey && fieldIds?.epicLink && issue.fields[fieldIds.epicLink]) {
        parentKey = issue.fields[fieldIds.epicLink]; // Usually a string Key
      }
      if (!parentKey && fieldIds?.parentLink && issue.fields[fieldIds.parentLink]) {
          // Parent Link can be complex. Typically it's a Box/Object but sometimes a key.
          // In raw JSON it often looks like { data: { key: ... } } or just the key string?
          // Safest to check if it's an object with key, or a string.
          const val = issue.fields[fieldIds.parentLink];
          parentKey = (typeof val === 'string') ? val : val?.key || val?.data?.key;
      }

      return {
        key: issue.key,
        url: `https://${cleanHost}/browse/${issue.key}`,
        summary: issue.fields.summary || '',
        status: issue.fields.status?.name || 'Unknown',
        created: issue.fields.created,
        issueType: issue.fields.issuetype?.name || 'Unknown',
        issueTypeIconUrl: issue.fields.issuetype?.iconUrl,
        parentKey: parentKey,
        changelog: issue.changelog
      };
    });

    console.log(`Fetched ${cleanData.length} issues for hierarchy of ${issueId}`);

    return { 
      success: true, 
      data: cleanData
    };

  } catch (error: any) {
    console.error('Jira API Error:', error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data?.errorMessages?.join(', ') || error.message 
    };
  }
});

// --- End Jira API Handling ---

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1800,
    height: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
