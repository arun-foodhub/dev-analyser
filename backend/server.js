const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { scanEndpoints } = require('./scanners/endpoint-scanner');
const { scanModules } = require('./scanners/module-scanner');
const { scanApiModules } = require('./scanners/api-module-scanner');

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'repos.json');
const ENDPOINTS_PATH = path.join(DATA_DIR, 'endpoints.json');
const MODULES_PATH = path.join(DATA_DIR, 'modules.json');
const API_MODULES_PATH = path.join(DATA_DIR, 'api-modules.json');

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
