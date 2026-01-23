const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const issueId = process.argv[2];
  if (!issueId) {
    console.error('Please provide an Issue ID: node debug-jira.js PROJ-123');
    process.exit(1);
  }

  // 1. Get Secrets
  const secretsPath = path.join(__dirname, 'jira-secrets.json');
  if (!fs.existsSync(secretsPath)) {
    console.error('jira-secrets.json not found in root.');
    process.exit(1);
  }
  const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

  // 2. Prepare Auth
  let authHeader;
  if (secrets.email) {
    const auth = Buffer.from(`${secrets.email}:${secrets.apiToken}`).toString('base64');
    authHeader = `Basic ${auth}`;
  } else {
    authHeader = `Bearer ${secrets.apiToken}`;
  }
  const host = secrets.host.replace(/^https?:\/\//, '');

  console.log(`Fetching ${issueId} from ${host}...`);

  try {
    // 3. Fetch
    const response = await axios.get(`https://${host}/rest/api/2/issue/${issueId}`, {
      params: { expand: 'changelog' },
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    
    // Check if it's a string (HTML error page?) or actual JSON
    if (typeof data === 'string') {
        console.error('Response is a STRING, likely an HTML Error Page or Login screen.');
        console.log('First 500 chars:', data.substring(0, 500));
        process.exit(1);
    }
    
    // 4. Dump Summary
    console.log('\n--- Summary ---');
    console.log('Key:', data.key);
    console.log('Status:', data.fields?.status?.name);
    console.log('Subtasks:', data.fields?.subtasks?.length || 0);
    
    // 5. Inspect Changelog
    console.log('\n--- Changelog ---');
    if (data.changelog) {
        console.log('Changelog Histories:', data.changelog.histories?.length);
        if (data.changelog.histories?.length > 0) {
            console.log('First History Item:', JSON.stringify(data.changelog.histories[0], null, 2));
        }
    } else {
        console.log('NO CHANGELOG FIELD RETURNED');
        console.log('Keys in root:', Object.keys(data));
        if (data.expand) console.log('Expand string:', data.expand);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
    }
  }
}

main();
