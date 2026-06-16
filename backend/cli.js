#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { scanEndpoints } = require('./scanners/endpoint-scanner');
const { scanModules } = require('./scanners/module-scanner');
const { scanApiModules } = require('./scanners/api-module-scanner');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'repos.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).repos;
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\n💾 Saved to ${path.relative(process.cwd(), filePath)}`);
}

const command = process.argv[2];

async function main() {
  const repos = loadConfig();

  if (!command || command === 'scan' || command === 'scan:all') {
    const [endpointsResult, modulesResult] = await Promise.all([
      scanEndpoints(repos),
      scanModules(repos),
    ]);
    writeJSON(path.join(DATA_DIR, 'endpoints.json'), endpointsResult);
    writeJSON(path.join(DATA_DIR, 'modules.json'), modulesResult);
    const apiModulesResult = await scanApiModules(repos, endpointsResult);
    writeJSON(path.join(DATA_DIR, 'api-modules.json'), apiModulesResult);
    console.log('\n✅ Full scan complete.\n');
    return;
  }

  if (command === 'scan:endpoints') {
    const result = await scanEndpoints(repos);
    writeJSON(path.join(DATA_DIR, 'endpoints.json'), result);
    console.log('\n✅ Endpoint scan complete.\n');
    return;
  }

  if (command === 'scan:modules') {
    const result = await scanModules(repos);
    writeJSON(path.join(DATA_DIR, 'modules.json'), result);
    console.log('\n✅ Module scan complete.\n');
    return;
  }

  if (command === 'scan:api-modules') {
    const endpointsData = (() => {
      const p = path.join(DATA_DIR, 'endpoints.json');
      if (!fs.existsSync(p)) return null;
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
    })();
    const result = await scanApiModules(repos, endpointsData);
    writeJSON(path.join(DATA_DIR, 'api-modules.json'), result);
    console.log('\n✅ API module scan complete.\n');
    return;
  }

  if (command === 'status') {
    for (const repo of repos) {
      const exists = fs.existsSync(repo.localPath);
      const symbol = exists ? '✅' : '❌';
      console.log(`${symbol} ${repo.name.padEnd(30)} ${repo.localPath}`);
    }
    return;
  }

  console.log(`
Dev Analyser CLI
================
Usage: node cli.js <command>

Commands:
  scan              Scan all repos (endpoints + modules + api-modules)
  scan:endpoints    Scan backend + frontend API endpoints only
  scan:modules      Scan frontend module structure only
  scan:api-modules  Scan backend repo modules (controllers, repos, services)
  status            Check which repos are available locally
`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
