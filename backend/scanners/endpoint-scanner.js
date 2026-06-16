const fs = require('fs');
const path = require('path');

// ─── Pattern definitions per tech stack ───────────────────────────────────────

const PATTERNS = {
  // Node.js/Express (JavaScript) - standard `router` or `app` variable
  nodejs: {
    route: [
      { re: /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
      { re: /\.route\s*\(\s*['"`]([^'"`\n]+)['"`]\)\s*\.(get|post|put|patch|delete)/gi, pathGroup: 1, methodGroup: 2 },
    ],
    fileGlobs: ['js', 'mjs', 'cjs'],
    exclude: ['node_modules', 'dist', 'build', '.git', 'coverage', '__tests__', 'spec'],
    priorityDirs: ['routes', 'route', 'api', 'src/routes', 'src/api', 'controllers'],
  },

  // Node.js TypeScript - any Express router variable name
  'nodejs-ts': {
    route: [
      // Any variable ending in routes/router/Route + express method
      { re: /\w+Routes?\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
      // Standard router/app
      { re: /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
      // Fastify style
      { re: /(?:fastify|server|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
    ],
    fileGlobs: ['ts', 'js', 'tsx', 'jsx'],
    exclude: ['node_modules', 'dist', 'build', '.git', 'coverage', '__tests__', '.test.', '.spec.', 'cdk'],
    priorityDirs: ['src/routes', 'src/server', 'src/api', 'routes', 'lambdas', 'handlers', 'src/lib/server'],
  },

  // PHP Lumen ($router->get/post pattern) — used by t2s-api
  'php-lumen': {
    route: [
      { re: /\$router->(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi, methodGroup: 1, pathGroup: 2 },
      { re: /\$router->group\s*\([^)]*'prefix'\s*=>\s*['"]([^'"]+)['"]/gi, pathGroup: 1, method: 'GROUP' },
    ],
    fileGlobs: ['php'],
    exclude: [
      'vendor', 'node_modules', '.git', 'storage', 'bootstrap/cache', 'public',
      'v2018_06_12', 'v2019_08_27', 'v2020_10_05', 'v2021_02_25', 'v2022_05_05',
    ],
    priorityDirs: ['app/Http', 'routes', 'app/routes'],
  },

  // PHP Laravel (Route:: facade) — used by foodhubglobal
  php: {
    route: [
      { re: /Route::(get|post|put|patch|delete|any)\s*\(\s*['"]([^'"]+)['"]/gi, methodGroup: 1, pathGroup: 2 },
      { re: /\$router->(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi, methodGroup: 1, pathGroup: 2 },
      { re: /\$app->(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi, methodGroup: 1, pathGroup: 2 },
    ],
    fileGlobs: ['php'],
    exclude: ['vendor', 'node_modules', '.git', 'storage', 'bootstrap/cache'],
    priorityDirs: ['routes', 'app/Http/Routes', 'app/Http/Controllers'],
  },

  // AWS CDK TypeScript (API Gateway addResource/addMethod)
  'aws-cdk-ts': {
    route: [
      // .addResource('path').addMethod('GET', ...)
      { re: /\.addResource\s*\(\s*['"`]([^'"`\n]+)['"`]\)\s*[\s\S]{0,200}?\.addMethod\s*\(\s*['"`](GET|POST|PUT|PATCH|DELETE|ANY)['"`]/gi, pathGroup: 1, methodGroup: 2 },
      // .addMethod('GET', ...)  on its own (after addResource on previous line)
      { re: /\.addMethod\s*\(\s*['"`](GET|POST|PUT|PATCH|DELETE|ANY)['"`]/gi, method: '$1', pathGroup: null },
      // addResource on its own
      { re: /addResource\s*\(\s*['"`]([^'"`\n]+)['"`]\)/gi, pathGroup: 1, method: 'RESOURCE' },
    ],
    fileGlobs: ['ts', 'js'],
    exclude: ['node_modules', 'dist', '.git', 'coverage', '__tests__', '__mocks__', 'cdk.out'],
    priorityDirs: ['cdk/services', 'cdk', 'src/stacks', 'lib'],
  },

  // React Native frontend
  'react-native': {
    call: [
      // apiService.get('/path'), axios.post('/path'), etc.
      { re: /(?:axios|api|apiClient|apiService|http|client|request|ApiService|instance|API)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
      // Template literal calls
      { re: /(?:axios|api|apiClient|apiService|http|client|request|instance)\.(get|post|put|patch|delete)\s*\(\s*`([^`\n]+)`/gi, methodGroup: 1, pathGroup: 2, isTemplate: true },
      // fetch('/path')
      { re: /fetch\s*\(\s*['"`](\/[^'"`\n]+)['"`]/gi, pathGroup: 1, method: 'GET' },
      // .get('/path'), .post('/path') generic chained calls
      { re: /\.(get|post|put|patch|delete)\s*\(\s*['"`](\/[^'"`\n]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
    ],
    fileGlobs: ['js', 'jsx', 'ts', 'tsx'],
    exclude: ['node_modules', 'android', 'ios', '.git', 'dist', 'build', '__tests__', '.test.', '.spec.'],
    priorityDirs: ['src/services', 'src/api', 'services', 'api', 'src/network', 'src/utils'],
  },
};

// ─── File walker ───────────────────────────────────────────────────────────────

function walkDir(dir, exts, excludeDirs) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current, depth = 0) {
    if (depth > 10) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.some(e => entry.name === e)) {
          walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1);
        if (exts.includes(ext)) results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function readFileSafe(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch { return null; }
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// ─── Backend scanner ──────────────────────────────────────────────────────────

function scanBackendRepo(repo) {
  const { localPath, name, technology } = repo;
  if (!fs.existsSync(localPath)) {
    console.log(`  [SKIP] ${name} — path not found`);
    return [];
  }

  const config = PATTERNS[technology] || PATTERNS.nodejs;
  const files = walkDir(localPath, config.fileGlobs, config.exclude);

  // Sort so priority dirs come first
  files.sort((a, b) => {
    const aP = config.priorityDirs.some(d => a.includes(`/${d}/`) || a.includes(`/${d}.`));
    const bP = config.priorityDirs.some(d => b.includes(`/${d}/`) || b.includes(`/${d}.`));
    return (bP ? 1 : 0) - (aP ? 1 : 0);
  });

  const routes = [];
  const seen = new Set();

  for (const filePath of files) {
    const content = readFileSafe(filePath);
    if (!content || content.length < 10) continue;

    const relPath = path.relative(localPath, filePath);
    if (relPath.includes('node_modules') || relPath.includes('vendor')) continue;

    for (const pattern of config.route) {
      if (!pattern.pathGroup && !pattern.method) continue;

      const re = new RegExp(pattern.re.source, 'gi');
      let match;
      while ((match = re.exec(content)) !== null) {
        const method = pattern.methodGroup
          ? match[pattern.methodGroup]?.toUpperCase()
          : (pattern.method || 'ANY');

        const routePath = pattern.pathGroup ? match[pattern.pathGroup] : null;

        if (!routePath || routePath.length < 2) continue;
        if (routePath.length > 200) continue;
        // Skip test fixtures / mock data strings
        if (/\.(js|ts|jsx|tsx|php|html|css)$/.test(routePath)) continue;

        const lineNumber = getLineNumber(content, match.index);
        const key = `${name}::${method}::${routePath}::${relPath}::${lineNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const id = `${name}-${method}-${routePath}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');

        routes.push({
          id,
          method: method || 'ANY',
          path: routePath,
          normalizedPath: routePath
            .replace(/:[a-zA-Z_]+/g, ':param')
            .replace(/\{[a-zA-Z_]+\}/g, ':param'),
          source: 'backend',
          repo: name,
          repoType: repo.type,
          technology,
          file: relPath,
          line: lineNumber,
          fullPath: filePath,
          matchedFrontendCalls: [],
          tags: [],
          mockPayload: null,
          mockResponse: null,
        });
      }
    }
  }

  console.log(`  [OK] ${name} (${technology}) — ${routes.length} routes in ${files.length} files scanned`);
  return routes;
}

// ─── Frontend scanner ─────────────────────────────────────────────────────────

/**
 * Read the curated .memory/api-integration/API_ENDPOINTS.json if present.
 * This file is maintained by Claude agents inside the repo and has richer
 * data (payloads, versions, auth flags) than raw regex scanning.
 */
function readMemoryEndpoints(localPath, repoName) {
  const memFile = path.join(localPath, '.memory', 'api-integration', 'API_ENDPOINTS.json');
  if (!fs.existsSync(memFile)) return [];

  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(memFile, 'utf8')); } catch { return []; }

  const calls = [];
  const seen  = new Set();

  // Walk all values in the parsed object recursively looking for endpoint arrays
  function extractEndpoints(obj, source) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) extractEndpoints(item, source);
      return;
    }
    // Check if this object looks like an endpoint definition
    if (obj.url && obj.method && typeof obj.url === 'string') {
      const cleanPath = obj.url
        .replace(/\$\{[^}]+\}/g, ':param')
        .replace(/^https?:\/\/[^/]+/, '')
        .trim();
      if (cleanPath.length < 2) return;

      const key = `${obj.method}::${cleanPath}`;
      if (seen.has(key)) return;
      seen.add(key);

      calls.push({
        repo: repoName,
        file: obj.file || source || '.memory/api-integration/API_ENDPOINTS.json',
        line: 0,
        method: (obj.method || 'GET').toUpperCase(),
        path: cleanPath,
        rawCall: obj.name || cleanPath,
        isTemplate: cleanPath.includes(':param'),
        mockPayload: obj.payload || obj.requestPayload || null,
        mockResponse: obj.response || obj.responseSchema || null,
        authRequired: obj.authentication ?? obj.authRequired ?? null,
        versions: obj.versions || null,
        endpointName: obj.name || null,
        fromMemory: true,
      });
    }
    // Recurse into object values
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') extractEndpoints(val, source);
    }
  }

  extractEndpoints(parsed, '.memory/api-integration/API_ENDPOINTS.json');
  return calls;
}

/**
 * Scan Network/*.js files in AppModules for the custom url/method object pattern.
 */
function scanNetworkFiles(localPath, repoName) {
  const modulesDir = path.join(localPath, 'old_code', 'AppModules');
  if (!fs.existsSync(modulesDir)) return [];

  const calls = [];
  const seen  = new Set();

  // url: `/path` or url: '/path' pattern
  const urlRe     = /url\s*:\s*[`'"]([^`'"$\n]+)[`'"]/gi;
  const methodRe  = /method\s*:\s*NETWORK_METHOD\.([A-Z]+)/gi;
  // Also: method: 'GET' etc.
  const methodRe2 = /method\s*:\s*['"]([A-Z]+)['"]/gi;

  function walkModules(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        const networkDir = path.join(dir, e.name, 'Network');
        if (fs.existsSync(networkDir)) {
          for (const f of fs.readdirSync(networkDir)) {
            if (!f.endsWith('.js') && !f.endsWith('.ts')) continue;
            const fp = path.join(networkDir, f);
            const content = readFileSafe(fp);
            if (!content) continue;
            const relPath = path.relative(localPath, fp);

            // Extract URL and nearby method in chunks
            const urlMatches = [...content.matchAll(new RegExp(urlRe.source, 'gi'))];
            for (const um of urlMatches) {
              let rawUrl = um[1];
              if (!rawUrl || rawUrl.length < 2) continue;
              rawUrl = rawUrl.replace(/\$\{[^}]+\}/g, ':param').replace(/^https?:\/\/[^/]+/, '').trim();
              if (!rawUrl.startsWith('/') && !rawUrl.startsWith('consumer') && !rawUrl.includes('/')) continue;
              const normUrl = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;

              // Find nearest method declaration (within 500 chars before the url)
              const pos = um.index;
              const surroundingBefore = content.substring(Math.max(0, pos - 300), pos + 300);
              let method = 'GET';
              const m1 = surroundingBefore.match(/NETWORK_METHOD\.([A-Z]+)/i);
              const m2 = surroundingBefore.match(/method\s*:\s*['"]([A-Z]+)['"]/i);
              if (m1) method = m1[1].toUpperCase();
              else if (m2) method = m2[1].toUpperCase();

              const key = `${method}::${normUrl}`;
              if (seen.has(key)) continue;
              seen.add(key);

              const line = getLineNumber(content, um.index);
              calls.push({ repo: repoName, file: relPath, line, method, path: normUrl, rawCall: um[0].trim() });
            }
          }
        }
      }
    }
  }

  walkModules(modulesDir);
  return calls;
}

function scanFrontendRepo(repo) {
  const { localPath, name } = repo;
  if (!fs.existsSync(localPath)) {
    console.log(`  [SKIP] ${name} — path not found`);
    return [];
  }

  // 1. Try curated memory file first (richer data)
  const memoryCalls = readMemoryEndpoints(localPath, name);
  if (memoryCalls.length > 0) {
    console.log(`  [MEMORY] ${name} — ${memoryCalls.length} endpoints from .memory file`);
  }

  // 2. Scan old_code Network files (AppModules architecture)
  const networkCalls = scanNetworkFiles(localPath, name);
  if (networkCalls.length > 0) {
    console.log(`  [NETWORK] ${name} — ${networkCalls.length} calls from AppModules/*/Network`);
  }

  // 3. Standard regex scan for new packages/ code
  const config = PATTERNS['react-native'];
  const files = walkDir(localPath, config.fileGlobs, config.exclude);
  const regexCalls = [];
  const seenRegex  = new Set();

  files.sort((a, b) => {
    const aP = config.priorityDirs.some(d => a.includes(`/${d}/`));
    const bP = config.priorityDirs.some(d => b.includes(`/${d}/`));
    return (bP ? 1 : 0) - (aP ? 1 : 0);
  });

  for (const filePath of files) {
    const content = readFileSafe(filePath);
    if (!content) continue;
    const relPath = path.relative(localPath, filePath);

    for (const pattern of config.call) {
      const re = new RegExp(pattern.re.source, 'gi');
      let match;
      while ((match = re.exec(content)) !== null) {
        const method = pattern.methodGroup
          ? match[pattern.methodGroup]?.toUpperCase()
          : (pattern.method || 'GET');

        const rawPath = match[pattern.pathGroup];
        if (!rawPath) continue;

        const cleanPath = rawPath
          .replace(/\$\{[^}]+\}/g, ':param')
          .replace(/^https?:\/\/[^/]+/, '')
          .trim();

        if (!cleanPath || cleanPath.length < 2) continue;
        if (!cleanPath.startsWith('/') && !cleanPath.includes('/')) continue;

        const lineNumber = getLineNumber(content, match.index);
        const key = `${relPath}:${lineNumber}:${method}:${cleanPath}`;
        if (seenRegex.has(key)) continue;
        seenRegex.add(key);

        regexCalls.push({
          repo: name, file: relPath, line: lineNumber,
          method, path: cleanPath, rawCall: match[0].slice(0, 120),
          isTemplate: !!pattern.isTemplate,
        });
      }
    }
  }

  if (regexCalls.length > 0) {
    console.log(`  [REGEX] ${name} — ${regexCalls.length} calls from source files`);
  }

  // Merge all sources, deduplicate by path+method
  const allCalls = [...memoryCalls, ...networkCalls, ...regexCalls];
  const deduped  = [];
  const deupSeen = new Set();
  for (const call of allCalls) {
    const norm = normalizePath(call.path);
    const k    = `${call.method}::${norm}`;
    if (!deupSeen.has(k)) {
      deupSeen.add(k);
      deduped.push(call);
    }
  }

  console.log(`  [OK] ${name} — ${deduped.length} unique API calls total`);
  return deduped;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

function normalizePath(p) {
  return p
    .replace(/:[a-zA-Z_]+/g, ':param')
    .replace(/\{[a-zA-Z_]+\}/g, ':param')
    .replace(/\[.*?\]/g, ':param')
    .replace(/\/+$/, '')
    .toLowerCase()
    .trim();
}

function matchEndpoints(backendRoutes, frontendCalls) {
  const normalizedRoutes = backendRoutes.map(r => ({
    ...r,
    _norm: normalizePath(r.path),
  }));

  const frontendOnlyCalls = [];

  for (const call of frontendCalls) {
    const nc = normalizePath(call.path);
    const matched = normalizedRoutes.filter(r => {
      if (r._norm === nc) return true;
      // Allow suffix matching for base-URL prefixed paths
      if (r._norm.length > 3 && nc.endsWith(r._norm)) return true;
      if (nc.length > 3 && r._norm.endsWith(nc)) return true;
      return false;
    });

    if (matched.length > 0) {
      for (const route of matched) {
        route.matchedFrontendCalls.push({
          repo: call.repo,
          file: call.file,
          line: call.line,
          callMethod: call.method,
          rawCall: call.rawCall,
        });
      }
    } else {
      frontendOnlyCalls.push({
        id: `fe-${call.method}-${call.path}`.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-'),
        method: call.method,
        path: call.path,
        source: 'frontend',
        repo: call.repo,
        file: call.file,
        line: call.line,
        rawCall: call.rawCall,
        isTemplate: call.isTemplate,
      });
    }
  }

  return {
    backendRoutes: normalizedRoutes.map(({ _norm, ...r }) => r),
    frontendOnlyCalls,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function scanEndpoints(repos) {
  console.log('\n🔍 Scanning endpoints...\n');

  const frontendRepos = repos.filter(r => r.type === 'frontend');
  const backendRepos  = repos.filter(r => r.type === 'backend' || r.type === 'monolith');

  const allBackendRoutes = [];
  for (const repo of backendRepos) {
    console.log(`→ Backend: ${repo.name} (${repo.technology})`);
    allBackendRoutes.push(...scanBackendRepo(repo));
  }

  const allFrontendCalls = [];
  for (const repo of frontendRepos) {
    console.log(`→ Frontend: ${repo.name}`);
    allFrontendCalls.push(...scanFrontendRepo(repo));
  }

  console.log('\n🔗 Matching...');
  const { backendRoutes, frontendOnlyCalls } = matchEndpoints(allBackendRoutes, allFrontendCalls);

  const matched   = backendRoutes.filter(r => r.matchedFrontendCalls.length > 0);
  const unmatched = backendRoutes.filter(r => r.matchedFrontendCalls.length === 0);

  const result = {
    lastScanned: new Date().toISOString(),
    stats: {
      totalBackendRoutes:   backendRoutes.length,
      totalFrontendCalls:   allFrontendCalls.length,
      matchedRoutes:        matched.length,
      unmatchedBackendRoutes: unmatched.length,
      frontendOnlyCalls:    frontendOnlyCalls.length,
    },
    endpoints: backendRoutes,
    frontendOnlyCalls,
  };

  console.log(`\n✅ ${backendRoutes.length} backend routes · ${allFrontendCalls.length} frontend calls · ${matched.length} matched`);
  return result;
}

module.exports = { scanEndpoints };
