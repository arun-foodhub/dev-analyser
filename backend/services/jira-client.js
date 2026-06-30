const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '../../config/jira-config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function makeRequest(config, method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    // Strip any accidental path suffix from baseUrl (e.g. /jira, /jira/software)
    const base = config.baseUrl.replace(/\/$/, '').replace(/\/(jira|software)(\/.*)?$/, '');
    const fullUrl = base + apiPath;
    let url;
    try { url = new URL(fullUrl); } catch (e) { return reject(new Error(`Invalid JIRA URL: ${fullUrl}`)); }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        } else if (res.statusCode === 401) {
          reject(Object.assign(new Error(
            'Authentication failed (401). Check: (1) email matches your Atlassian login, ' +
            '(2) API token is valid at id.atlassian.com → Security → API tokens, ' +
            '(3) base URL is exactly https://yourcompany.atlassian.net with no extra path.'
          ), { statusCode: 401 }));
        } else if (res.statusCode === 403) {
          reject(Object.assign(new Error('Forbidden (403) — account authenticated but lacks permission for this resource.'), { statusCode: 403 }));
        } else if (res.statusCode === 404) {
          let parsed = {};
          try { parsed = JSON.parse(data); } catch {}
          const jiraMsg = (parsed.errorMessages || []).join('; ') || data.slice(0, 200);
          reject(Object.assign(new Error(`Not found (404): ${jiraMsg}`), { statusCode: 404, jiraErrors: parsed }));
        } else {
          reject(Object.assign(new Error(`JIRA ${res.statusCode}: ${data.slice(0, 300)}`), { statusCode: res.statusCode }));
        }
      });
    });

    req.on('error', e => reject(new Error(`Network error connecting to JIRA: ${e.message}`)));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Convert plain text (with markdown-like headings) to Atlassian Document Format
function toAdf(text) {
  const lines = text.split('\n');
  const content = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: line.slice(3) }] });
    } else if (line.startsWith('### ')) {
      content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: line.slice(4) }] });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Collect bullet list items
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: lines[i].slice(2) }] }] });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      // Ordered list
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s/, '');
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        i++;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    } else if (line.trim()) {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
    } else {
      content.push({ type: 'paragraph', content: [] });
    }
    i++;
  }

  return { type: 'doc', version: 1, content: content.filter(n => n) };
}

async function testConnection() {
  const config = loadConfig();
  if (!config) throw new Error('JIRA not configured');
  return makeRequest(config, 'GET', '/rest/api/3/myself');
}

// Raw probe — never throws, returns full diagnostic info
function diagnose() {
  return new Promise(resolve => {
    const config = loadConfig();
    if (!config) return resolve({ configured: false, error: 'No config file found' });

    const base = config.baseUrl.replace(/\/$/, '').replace(/\/(jira|software)(\/.*)?$/, '');
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

    const results = {
      configured: true,
      baseUrl: base,
      email: config.email,
      tokenLength: config.apiToken ? config.apiToken.length : 0,
      tokenPrefix: config.apiToken ? config.apiToken.slice(0, 8) + '...' : '',
      authHeaderPrefix: ('Basic ' + auth).slice(0, 20) + '...',
      steps: [],
    };

    // Step 1: unauthenticated probe (check if host is reachable and what it returns)
    const url = new URL(base + '/rest/api/3/myself');
    let transport = url.protocol === 'https:' ? https : http;

    const unauthReq = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        results.steps.push({ step: 'unauthenticated_probe', status: res.statusCode, bodySnippet: d.slice(0, 120) });

        // Step 2: authenticated request
        const authReq = transport.request({
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'GET',
          headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        }, res2 => {
          let d2 = '';
          res2.on('data', c => (d2 += c));
          res2.on('end', () => {
            results.steps.push({ step: 'authenticated_request', status: res2.statusCode, bodySnippet: d2.slice(0, 300) });

            if (res2.statusCode === 200) {
              try {
                const me = JSON.parse(d2);
                results.success = true;
                results.displayName = me.displayName;
                results.accountEmail = me.emailAddress;
              } catch {}
            } else if (res2.statusCode === 401) {
              results.hint = 'Token or email wrong. ' +
                (config.email.includes('@foodhub.com')
                  ? 'Your Atlassian account might use a personal email (e.g. Gmail) not your work email. Check id.atlassian.com → profile.'
                  : 'Verify token at id.atlassian.com → Security → API tokens.');
            } else if (res2.statusCode === 403) {
              results.hint = 'Auth works but you lack permission. Your account may not have API access on this instance.';
            }
            resolve(results);
          });
        });
        authReq.on('error', e => { results.steps.push({ step: 'authenticated_request', error: e.message }); resolve(results); });
        authReq.end();
      });
    });
    unauthReq.on('error', e => { results.steps.push({ step: 'unauthenticated_probe', error: e.message, hint: 'Cannot reach host — check base URL' }); resolve(results); });
    unauthReq.end();
  });
}

async function listProjects() {
  const config = loadConfig();
  if (!config) throw new Error('JIRA not configured');
  const data = await makeRequest(config, 'GET', '/rest/api/3/project/search?maxResults=50&orderBy=name');
  return (data.values || []).map(p => ({
    key: p.key,
    name: p.name,
    type: p.projectTypeKey,
    style: p.style,
  }));
}

async function searchTickets(query, maxResults = 20) {
  const config = loadConfig();
  if (!config) throw new Error('JIRA not configured');
  const jql = encodeURIComponent(`text ~ "${query}" ORDER BY updated DESC`);
  const data = await makeRequest(config, 'GET', `/rest/api/3/search?jql=${jql}&maxResults=${maxResults}&fields=summary,status,priority,issuetype,assignee`);
  return (data.issues || []).map(i => ({
    key: i.key,
    title: i.fields?.summary || '',
    status: i.fields?.status?.name || '',
    priority: i.fields?.priority?.name || '',
    type: i.fields?.issuetype?.name || '',
    assignee: i.fields?.assignee?.displayName || 'Unassigned',
  }));
}

async function getTicket(ticketId) {
  const config = loadConfig();
  if (!config) throw new Error('JIRA not configured');
  const issue = await makeRequest(config, 'GET', `/rest/api/3/issue/${encodeURIComponent(ticketId)}`);

  // Flatten to a clean object
  const f = issue.fields || {};
  return {
    id: issue.id,
    key: issue.key,
    title: f.summary || '',
    description: extractAdfText(f.description),
    status: f.status?.name || '',
    statusCategory: f.status?.statusCategory?.name || '',
    priority: f.priority?.name || '',
    type: f.issuetype?.name || '',
    reporter: f.reporter?.displayName || '',
    assignee: f.assignee?.displayName || 'Unassigned',
    labels: f.labels || [],
    url: `${(loadConfig()?.baseUrl || '').replace(/\/$/, '')}/browse/${issue.key}`,
    raw: issue,
  };
}

// Extract plain text from ADF description
function extractAdfText(adf) {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  if (!adf.content) return '';

  function walk(nodes) {
    return (nodes || []).map(n => {
      if (n.type === 'text') return n.text || '';
      if (n.type === 'hardBreak') return '\n';
      if (n.type === 'paragraph') return walk(n.content) + '\n';
      if (n.type === 'heading') return '## ' + walk(n.content) + '\n';
      if (n.type === 'bulletList') return (n.content || []).map(li => '• ' + walk(li.content)).join('');
      if (n.type === 'orderedList') return (n.content || []).map((li, i) => `${i + 1}. ` + walk(li.content)).join('');
      if (n.type === 'listItem') return walk(n.content) + '\n';
      if (n.type === 'codeBlock') return '```\n' + walk(n.content) + '\n```\n';
      return walk(n.content || []);
    }).join('');
  }

  return walk(adf.content).trim();
}

async function addComment(ticketId, text) {
  const config = loadConfig();
  if (!config) throw new Error('JIRA not configured');
  return makeRequest(config, 'POST', `/rest/api/3/issue/${encodeURIComponent(ticketId)}/comment`, {
    body: toAdf(text),
  });
}

async function updateDescription(ticketId, text) {
  const config = loadConfig();
  if (!config) throw new Error('JIRA not configured');
  return makeRequest(config, 'PUT', `/rest/api/3/issue/${encodeURIComponent(ticketId)}`, {
    fields: { description: toAdf(text) },
  });
}

module.exports = { loadConfig, saveConfig, getTicket, addComment, updateDescription, testConnection, diagnose, listProjects, searchTickets, toAdf };
