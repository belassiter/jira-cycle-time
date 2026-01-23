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

// Helper for making the actual Axios call
async function fetchSingleIssue(issueId: string, secrets: JiraSecrets) {
  let authHeader: string;
  if (secrets.email) {
     const auth = Buffer.from(`${secrets.email}:${secrets.apiToken}`).toString('base64');
     authHeader = `Basic ${auth}`;
  } else {
     authHeader = `Bearer ${secrets.apiToken}`;
  }
  
  const host = secrets.host.replace(/^https?:\/\//, '');

  console.log(`JIRA-FETCH: ${issueId} from ${host} using V2 API`);

  // Force V2 API for Data Center
  const response = await axios.get(`https://${host}/rest/api/2/issue/${issueId}`, {
    params: { expand: 'changelog' },
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });
  return response.data;
}

ipcMain.handle('jira-get-issue', async (_event, issueId: string) => {
  try {
    const secrets = getSecrets();
    
    // 1. Fetch the requested issue (Parent)
    const parentData = await fetchSingleIssue(issueId, secrets);
    
    // 2. Check for sub-tasks
    const subtasks = parentData.fields?.subtasks || [];
    let childrenData: any[] = [];

    // 3. Recursive Fetch: If there are subtasks, fetch their full details (with changelog) in parallel
    if (subtasks.length > 0) {
      console.log(`Fetching ${subtasks.length} subtasks for ${issueId}...`);
      const promises = subtasks.map((task: any) => fetchSingleIssue(task.key, secrets));
      
      // Use Promise.allSettled to ensure one failure doesn't break the whole request
      const results = await Promise.allSettled(promises);
      
      childrenData = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
        
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`${failures.length} subtasks failed to load.`);
      }
    }

    return { 
      success: true, 
      data: {
        parent: parentData,
        children: childrenData
      } 
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

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
