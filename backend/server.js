const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { scanEndpoints } = require('./scanners/endpoint-scanner');
const { scanModules } = require('./scanners/module-scanner');
const { scanApiModules } = require('./scanners/api-module-scanner');
const { scanFoodhubglobal } = require('./scanners/foodhubglobal-scanner');
const { scanTaskSummaries } = require('./scanners/tasksummary-scanner');
const jira = require('./services/jira-client');
const { listProjects, searchTickets, diagnose } = jira;

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'repos.json');
const ENDPOINTS_PATH = path.join(DATA_DIR, 'endpoints.json');
const MODULES_PATH = path.join(DATA_DIR, 'modules.json');
const API_MODULES_PATH = path.join(DATA_DIR, 'api-modules.json');
const FOODHUBGLOBAL_MODULES_PATH = path.join(DATA_DIR, 'foodhubglobal-modules.json');
const TASKSUMMARIES_PATH = path.join(DATA_DIR, 'tasksummaries.json');
const JIRA_SESSION_PATH = path.join(DATA_DIR, 'jira-session.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// Serve built frontend
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw).repos;
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function checkRepoStatus(repos) {
  return repos.map(r => ({
    ...r,
    exists: fs.existsSync(r.localPath),
  }));
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// Repos config + status
app.get('/api/repos', (req, res) => {
  const repos = loadConfig();
  res.json(checkRepoStatus(repos));
});

// Endpoints data
app.get('/api/endpoints', (req, res) => {
  const data = readJSON(ENDPOINTS_PATH);
  if (!data) return res.json({ endpoints: [], frontendOnlyCalls: [], stats: {}, lastScanned: null, notScanned: true });
  res.json(data);
});

// Modules data
app.get('/api/modules', (req, res) => {
  const data = readJSON(MODULES_PATH);
  if (!data) return res.json({ modules: {}, stats: {}, lastScanned: null, notScanned: true });
  res.json(data);
});

// Trigger endpoint scan
app.post('/api/scan/endpoints', async (req, res) => {
  try {
    const repos = loadConfig();
    const result = await scanEndpoints(repos);
    writeJSON(ENDPOINTS_PATH, result);
    res.json({ success: true, stats: result.stats, lastScanned: result.lastScanned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API modules data
app.get('/api/api-modules', (req, res) => {
  const data = readJSON(API_MODULES_PATH);
  if (!data) return res.json({ modules: {}, stats: {}, lastScanned: null, notScanned: true });
  res.json(data);
});

// Trigger module scan
app.post('/api/scan/modules', async (req, res) => {
  try {
    const repos = loadConfig();
    const result = await scanModules(repos);
    writeJSON(MODULES_PATH, result);
    res.json({ success: true, stats: result.stats, lastScanned: result.lastScanned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger API module scan
app.post('/api/scan/api-modules', async (req, res) => {
  try {
    const repos = loadConfig();
    const endpointsData = readJSON(ENDPOINTS_PATH);
    const result = await scanApiModules(repos, endpointsData);
    writeJSON(API_MODULES_PATH, result);
    res.json({ success: true, stats: result.stats, lastScanned: result.lastScanned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger full scan
app.post('/api/scan/all', async (req, res) => {
  try {
    const repos = loadConfig();
    const [endpointsResult, modulesResult] = await Promise.all([
      scanEndpoints(repos),
      scanModules(repos),
    ]);
    writeJSON(ENDPOINTS_PATH, endpointsResult);
    writeJSON(MODULES_PATH, modulesResult);
    // api-modules depends on endpoints, run after
    const apiModulesResult = await scanApiModules(repos, endpointsResult);
    writeJSON(API_MODULES_PATH, apiModulesResult);
    res.json({
      success: true,
      endpoints: endpointsResult.stats,
      modules: modulesResult.stats,
      apiModules: apiModulesResult.stats,
      lastScanned: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// FoodHub Global modules data
app.get('/api/foodhubglobal-modules', (req, res) => {
  const data = readJSON(FOODHUBGLOBAL_MODULES_PATH);
  if (!data) return res.json({ modules: {}, stats: {}, lastScanned: null, notScanned: true });
  res.json(data);
});

// Trigger FoodHub Global module scan
app.post('/api/scan/foodhubglobal-modules', async (req, res) => {
  try {
    const repos = loadConfig();
    const result = scanFoodhubglobal(repos);
    writeJSON(FOODHUBGLOBAL_MODULES_PATH, result);
    res.json({ success: true, stats: result.stats, lastScanned: result.lastScanned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Task summaries data
app.get('/api/tasksummaries', (req, res) => {
  const data = readJSON(TASKSUMMARIES_PATH);
  if (!data) return res.json({ tasks: [], total: 0, lastScanned: null, notScanned: true });
  res.json(data);
});

// Trigger task summaries scan
app.post('/api/scan/tasksummaries', async (req, res) => {
  try {
    const repos = loadConfig();
    const result = scanTaskSummaries(repos);
    writeJSON(TASKSUMMARIES_PATH, result);
    res.json({ success: true, total: result.total, lastScanned: result.lastScanned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── JIRA Integration ────────────────────────────────────────────────────────

// Config: check status
app.get('/api/jira/config', (req, res) => {
  const config = jira.loadConfig();
  if (!config) return res.json({ configured: false });
  res.json({ configured: true, baseUrl: config.baseUrl, email: config.email });
});

// Config: save credentials
app.post('/api/jira/config', (req, res) => {
  const { baseUrl, email, apiToken } = req.body;
  if (!baseUrl || !email || !apiToken) return res.status(400).json({ error: 'baseUrl, email and apiToken required' });
  jira.saveConfig({ baseUrl, email, apiToken });
  res.json({ ok: true });
});

// Config: test connection
app.post('/api/jira/config/test', async (req, res) => {
  try {
    const me = await jira.testConnection();
    res.json({ ok: true, displayName: me.displayName, email: me.emailAddress });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Config: detailed diagnose (never throws, returns full breakdown)
app.get('/api/jira/config/diagnose', async (req, res) => {
  const result = await diagnose();
  res.json(result);
});

// List accessible JIRA projects
app.get('/api/jira/projects', async (req, res) => {
  try {
    const projects = await listProjects();
    res.json({ projects });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Search JIRA tickets by text
app.get('/api/jira/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q query param required' });
  try {
    const results = await searchTickets(q);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch a JIRA ticket
app.get('/api/jira/ticket/:id', async (req, res) => {
  try {
    const ticket = await jira.getTicket(req.params.id);
    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Session management ───────────────────────────────────────────────────────

function loadSession() {
  return readJSON(JIRA_SESSION_PATH);
}

function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  writeJSON(JIRA_SESSION_PATH, session);
}

// Get current session
app.get('/api/jira/session', (req, res) => {
  const session = loadSession();
  if (!session) return res.json({ active: false });
  res.json({ active: true, ...session });
});

// Create or replace session
app.post('/api/jira/session', (req, res) => {
  const { ticketId, ticketTitle, ticketDescription, ticketStatus, ticketType, ticketPriority,
          ticketUrl, assignee, reporter, analysis, tasks } = req.body;
  if (!ticketId) return res.status(400).json({ error: 'ticketId required' });
  const session = {
    ticketId, ticketTitle, ticketDescription, ticketStatus, ticketType,
    ticketPriority, ticketUrl, assignee, reporter,
    analysis: analysis || '',
    tasks: (tasks || []).map((t, i) => ({
      id: t.id || `task-${Date.now()}-${i}`,
      order: t.order ?? i,
      title: t.title,
      description: t.description || '',
      repo: t.repo || '',
      area: t.area || '',
      status: t.status || 'pending',
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jiraUpdated: false,
    commentAdded: false,
  };
  saveSession(session);
  res.json({ ok: true, session });
});

// Update session fields (analysis text, jiraUpdated flag, etc.)
app.patch('/api/jira/session', (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  const allowed = ['analysis', 'jiraUpdated', 'commentAdded'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) session[key] = req.body[key];
  }
  saveSession(session);
  res.json({ ok: true });
});

// Clear session
app.delete('/api/jira/session', (req, res) => {
  if (fs.existsSync(JIRA_SESSION_PATH)) fs.unlinkSync(JIRA_SESSION_PATH);
  res.json({ ok: true });
});

// ── Task management ──────────────────────────────────────────────────────────

// Add a task
app.post('/api/jira/tasks', (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  const { title, description, repo, area } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const task = {
    id: `task-${Date.now()}`,
    order: session.tasks.length,
    title,
    description: description || '',
    repo: repo || '',
    area: area || '',
    status: 'pending',
  };
  session.tasks.push(task);
  saveSession(session);
  res.json({ ok: true, task });
});

// Update a task (status, title, description, etc.)
app.patch('/api/jira/tasks/:id', (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  const task = session.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const allowed = ['title', 'description', 'status', 'repo', 'area'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) task[key] = req.body[key];
  }
  saveSession(session);
  res.json({ ok: true, task });
});

// Remove a task
app.delete('/api/jira/tasks/:id', (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  session.tasks = session.tasks.filter(t => t.id !== req.params.id);
  session.tasks.forEach((t, i) => (t.order = i));
  saveSession(session);
  res.json({ ok: true });
});

// Reorder tasks
app.put('/api/jira/tasks/reorder', (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
  const map = Object.fromEntries(session.tasks.map(t => [t.id, t]));
  session.tasks = orderedIds.map((id, i) => ({ ...map[id], order: i })).filter(Boolean);
  saveSession(session);
  res.json({ ok: true });
});

// ── JIRA write-back ──────────────────────────────────────────────────────────

// Push analysis + task plan as a comment to JIRA
app.post('/api/jira/push-analysis', async (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  try {
    const taskLines = session.tasks
      .sort((a, b) => a.order - b.order)
      .map((t, i) => `${i + 1}. [${t.status === 'completed' ? 'x' : ' '}] ${t.title}${t.repo ? ` (${t.repo})` : ''}`)
      .join('\n');

    const text = [
      `## Dev Analyser — Implementation Plan`,
      ``,
      `**Ticket:** ${session.ticketId} — ${session.ticketTitle}`,
      ``,
      `### Analysis`,
      session.analysis || '(no analysis yet)',
      ``,
      `### Task Plan`,
      taskLines || '(no tasks)',
      ``,
      `---`,
      `_Generated by Dev Analyser_`,
    ].join('\n');

    await jira.addComment(session.ticketId, text);
    session.jiraUpdated = true;
    saveSession(session);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add final implementation comment to JIRA
app.post('/api/jira/add-comment', async (req, res) => {
  const session = loadSession();
  if (!session) return res.status(404).json({ error: 'No active session' });
  const { notes } = req.body;
  try {
    const completed = session.tasks.filter(t => t.status === 'completed');
    const skipped = session.tasks.filter(t => t.status === 'skipped');

    const taskLines = session.tasks
      .sort((a, b) => a.order - b.order)
      .map(t => {
        const icon = t.status === 'completed' ? '✓' : t.status === 'skipped' ? '⊘' : '○';
        return `${icon} ${t.title}${t.repo ? ` (${t.repo})` : ''}`;
      }).join('\n');

    const text = [
      `## Implementation Complete`,
      ``,
      `**Ticket:** ${session.ticketId}`,
      `**Tasks completed:** ${completed.length} / ${session.tasks.length}${skipped.length ? ` (${skipped.length} skipped)` : ''}`,
      ``,
      `### Tasks`,
      taskLines,
      ``,
      `### Implementation Notes`,
      notes || '(no notes provided)',
      ``,
      `---`,
      `_Updated by Dev Analyser_`,
    ].join('\n');

    await jira.addComment(session.ticketId, text);
    session.commentAdded = true;
    saveSession(session);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dev Analyser API running on http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api/repos\n`);
});
