const fs = require('fs');
const path = require('path');

const SITEMASTER_ROOT = 'apps/sitemaster/src';

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function walkDir(dirPath, exts, maxDepth = 5) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  walk(dirPath, 0);
  return results;
}

function rel(repoPath, fullPath) {
  return fullPath.replace(repoPath + '/', '');
}

function extractHttpMethods(content) {
  const methods = [];
  if (/export\s+(?:async\s+)?function\s+GET\b/.test(content)) methods.push('GET');
  if (/export\s+(?:async\s+)?function\s+POST\b/.test(content)) methods.push('POST');
  if (/export\s+(?:async\s+)?function\s+PUT\b/.test(content)) methods.push('PUT');
  if (/export\s+(?:async\s+)?function\s+PATCH\b/.test(content)) methods.push('PATCH');
  if (/export\s+(?:async\s+)?function\s+DELETE\b/.test(content)) methods.push('DELETE');
  return methods.length ? methods : ['GET'];
}

function routeFromApiPath(repoPath, filePath) {
  // e.g. apps/sitemaster/src/app/api/seo-templates/route.ts -> /api/seo-templates
  const relative = rel(repoPath, filePath);
  const match = relative.match(/app(\/api\/.+)\/route\.ts$/);
  if (match) return match[1];
  return null;
}

function pageRouteFromPath(repoPath, filePath) {
  // e.g. apps/sitemaster/src/app/seo-templates/page.tsx -> /seo-templates
  const relative = rel(repoPath, filePath);
  const match = relative.match(/app((?:\/[^/]+)*)\/page\.tsx$/);
  if (!match) return null;
  const route = match[1] || '/';
  return route || '/';
}

function humanName(route) {
  if (route === '/') return 'Dashboard';
  const last = route.split('/').filter(Boolean).pop() || '';
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\[([^\]]+)\]/, '[$1]');
}

function extractReduxSliceInfo(content, filename) {
  const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  const stateMatch = content.match(/initialState[^:]*:\s*\{([^}]+)\}/s);
  const asyncThunks = [];
  const re = /createAsyncThunk\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) asyncThunks.push(m[1]);
  return {
    sliceName: nameMatch ? nameMatch[1] : filename.replace(/Slice\.ts$/, ''),
    asyncThunks,
  };
}

function extractServiceExports(content) {
  const exports = [];
  const re = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = re.exec(content)) !== null) exports.push(m[1]);
  return exports;
}

function scanFoodhubglobal(repos) {
  const repoConfig = repos.find(r => r.name === 'foodhubglobal');
  if (!repoConfig || !fs.existsSync(repoConfig.localPath)) {
    return { modules: { foodhubglobal: [] }, stats: {}, lastScanned: new Date().toISOString(), notScanned: false };
  }

  const repoPath = repoConfig.localPath;
  const appDir = path.join(repoPath, SITEMASTER_ROOT, 'app');
  const componentsDir = path.join(repoPath, SITEMASTER_ROOT, 'components');
  const reduxDir = path.join(repoPath, SITEMASTER_ROOT, 'redux');
  const servicesDir = path.join(repoPath, SITEMASTER_ROOT, 'services');
  const hooksDir = path.join(repoPath, SITEMASTER_ROOT, 'hooks');
  const libDir = path.join(repoPath, SITEMASTER_ROOT, 'lib');
  const libsUtilsDir = path.join(repoPath, 'libs/utils/src');

  // ── App Pages ──────────────────────────────────────────────────────────────
  const pageFiles = walkDir(appDir, ['.tsx'])
    .filter(f => f.endsWith('/page.tsx') && !f.includes('/api/'));

  const pages = pageFiles.map(f => {
    const route = pageRouteFromPath(repoPath, f);
    return {
      name: humanName(route || '/'),
      route: route || '/',
      file: rel(repoPath, f),
    };
  }).sort((a, b) => a.route.localeCompare(b.route));

  // ── API Routes ─────────────────────────────────────────────────────────────
  const apiRouteFiles = walkDir(appDir, ['.ts'])
    .filter(f => f.endsWith('/route.ts'));

  const apiRoutes = apiRouteFiles.map(f => {
    const route = routeFromApiPath(repoPath, f);
    const content = readFileSafe(f) || '';
    const methods = extractHttpMethods(content);
    return {
      name: route || rel(repoPath, f),
      route: route || '?',
      methods,
      file: rel(repoPath, f),
    };
  }).sort((a, b) => a.route.localeCompare(b.route));

  // ── UI Components ──────────────────────────────────────────────────────────
  const uiComponentFiles = walkDir(path.join(componentsDir, 'ui'), ['.tsx', '.ts']);
  const uiComponents = uiComponentFiles.map(f => ({
    name: path.basename(f, path.extname(f)),
    file: rel(repoPath, f),
  })).sort((a, b) => a.name.localeCompare(b.name));

  // ── Layout Components ──────────────────────────────────────────────────────
  const layoutComponentFiles = walkDir(path.join(componentsDir, 'layout'), ['.tsx', '.ts']);
  const layoutComponents = layoutComponentFiles.map(f => ({
    name: path.basename(f, path.extname(f)),
    file: rel(repoPath, f),
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Playground components
  const playgroundComponentFiles = walkDir(path.join(appDir, 'playground', 'components'), ['.tsx', '.ts']);
  const playgroundComponents = playgroundComponentFiles.map(f => ({
    name: path.basename(f, path.extname(f)),
    file: rel(repoPath, f),
  }));

  // ── Redux Slices ───────────────────────────────────────────────────────────
  const sliceFiles = walkDir(path.join(reduxDir, 'slices'), ['.ts']);
  const reduxSlices = sliceFiles.map(f => {
    const content = readFileSafe(f) || '';
    const { sliceName, asyncThunks } = extractReduxSliceInfo(content, path.basename(f));
    return {
      name: sliceName,
      file: rel(repoPath, f),
      asyncThunks,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ── Services ───────────────────────────────────────────────────────────────
  const serviceFiles = walkDir(servicesDir, ['.ts']);
  const services = serviceFiles.map(f => {
    const content = readFileSafe(f) || '';
    return {
      name: path.basename(f, '.ts'),
      file: rel(repoPath, f),
      exports: extractServiceExports(content).slice(0, 6),
    };
  });

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const hookFiles = walkDir(hooksDir, ['.ts', '.tsx']);
  const hooks = hookFiles.map(f => ({
    name: path.basename(f, path.extname(f)),
    file: rel(repoPath, f),
  }));

  // ── Lib / Utilities ────────────────────────────────────────────────────────
  const libFiles = walkDir(libDir, ['.ts']).filter(f => !f.includes('/seo/'));
  const libSeoFiles = walkDir(path.join(libDir, 'seo'), ['.ts']);
  const libUtils = libFiles.map(f => ({
    name: path.basename(f, '.ts'),
    file: rel(repoPath, f),
  }));
  const libSeo = libSeoFiles.map(f => ({
    name: path.basename(f, '.ts'),
    file: rel(repoPath, f),
  }));

  // ── Shared Utils Library ───────────────────────────────────────────────────
  const utilsFiles = walkDir(libsUtilsDir, ['.ts']).filter(f => !f.includes('.spec.'));
  const utilsLib = utilsFiles.map(f => ({
    name: path.basename(f, '.ts'),
    file: rel(repoPath, f),
  }));

  // ── Build modules array ────────────────────────────────────────────────────
  const modules = [
    {
      id: 'pages',
      name: 'App Pages',
      type: 'pages',
      count: pages.length,
      items: pages,
    },
    {
      id: 'api-routes',
      name: 'API Routes',
      type: 'api-routes',
      count: apiRoutes.length,
      items: apiRoutes,
    },
    {
      id: 'redux-slices',
      name: 'Redux Slices',
      type: 'redux',
      count: reduxSlices.length,
      items: reduxSlices,
    },
    {
      id: 'services',
      name: 'Services',
      type: 'services',
      count: services.length,
      items: services,
    },
    {
      id: 'hooks',
      name: 'Custom Hooks',
      type: 'hooks',
      count: hooks.length,
      items: hooks,
    },
    {
      id: 'ui-components',
      name: 'UI Components',
      type: 'components',
      count: uiComponents.length,
      items: uiComponents,
    },
    {
      id: 'layout-components',
      name: 'Layout Components',
      type: 'components',
      count: layoutComponents.length,
      items: layoutComponents,
    },
    {
      id: 'playground-components',
      name: 'Playground Components',
      type: 'components',
      count: playgroundComponents.length,
      items: playgroundComponents,
    },
    {
      id: 'lib',
      name: 'Library Utilities',
      type: 'lib',
      count: libUtils.length + libSeo.length,
      items: [...libUtils, ...libSeo],
    },
    {
      id: 'utils-lib',
      name: 'Shared Utils (libs/utils)',
      type: 'lib',
      count: utilsLib.length,
      items: utilsLib,
    },
  ].filter(m => m.count > 0);

  const stats = {
    pages: pages.length,
    apiRoutes: apiRoutes.length,
    components: uiComponents.length + layoutComponents.length + playgroundComponents.length,
    reduxSlices: reduxSlices.length,
    services: services.length,
    hooks: hooks.length,
    libFiles: libUtils.length + libSeo.length + utilsLib.length,
  };

  return {
    modules: { foodhubglobal: modules },
    stats,
    lastScanned: new Date().toISOString(),
  };
}

module.exports = { scanFoodhubglobal };
