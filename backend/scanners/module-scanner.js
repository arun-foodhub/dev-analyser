const fs = require('fs');
const path = require('path');

// Known module groupings based on common React Native folder patterns
const MODULE_HINTS = {
  auth: { keywords: ['auth', 'login', 'register', 'signup', 'signin', 'password', 'forgot', 'otp', 'verify'], label: 'Authentication' },
  home: { keywords: ['home', 'dashboard', 'landing', 'welcome', 'main'], label: 'Home / Dashboard' },
  menu: { keywords: ['menu', 'food', 'item', 'product', 'catalogue', 'catalog', 'dish'], label: 'Menu & Items' },
  cart: { keywords: ['cart', 'basket', 'bag', 'order-summary', 'checkout'], label: 'Cart & Checkout' },
  order: { keywords: ['order', 'orders', 'tracking', 'track', 'history', 'past'], label: 'Orders & Tracking' },
  payment: { keywords: ['payment', 'pay', 'card', 'wallet', 'billing', 'transaction'], label: 'Payments' },
  profile: { keywords: ['profile', 'account', 'user', 'settings', 'preferences', 'address'], label: 'Profile & Settings' },
  store: { keywords: ['store', 'restaurant', 'vendor', 'shop', 'outlet'], label: 'Store / Restaurant' },
  search: { keywords: ['search', 'explore', 'discover', 'browse', 'filter'], label: 'Search & Discovery' },
  notification: { keywords: ['notification', 'alert', 'push', 'inbox'], label: 'Notifications' },
  support: { keywords: ['support', 'help', 'contact', 'faq', 'feedback', 'review', 'rating'], label: 'Support & Feedback' },
  navigation: { keywords: ['navigation', 'navigator', 'router', 'tab', 'drawer', 'stack'], label: 'Navigation' },
  components: { keywords: ['components', 'component', 'ui', 'shared', 'common', 'widgets'], label: 'Shared Components' },
  services: { keywords: ['services', 'service', 'api', 'network', 'http'], label: 'Services / API Layer' },
  utils: { keywords: ['utils', 'util', 'helpers', 'helper', 'hooks', 'hook', 'constants'], label: 'Utilities & Hooks' },
  redux: { keywords: ['redux', 'store', 'reducers', 'actions', 'slice', 'sagas', 'context'], label: 'State Management' },
};

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function walkDir(dir, exts, excludeDirs) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current, depth = 0) {
    if (depth > 8) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) walk(fullPath, depth + 1);
      } else if (entry.isFile() && exts.includes(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}

function classifyByKeyword(nameLower) {
  for (const [key, { keywords }] of Object.entries(MODULE_HINTS)) {
    if (keywords.some(kw => nameLower.includes(kw))) return key;
  }
  return 'other';
}

function extractComponentName(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base;
}

function extractImportsAndExports(content) {
  const imports = [];
  const exports = [];

  // Named/default exports
  const exportRe = /export\s+(?:default\s+)?(?:function|class|const|let)\s+([A-Z][a-zA-Z0-9]+)/g;
  let m;
  while ((m = exportRe.exec(content)) !== null) exports.push(m[1]);

  // Import statements
  const importRe = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
  while ((m = importRe.exec(content)) !== null) imports.push(m[1]);

  return { imports, exports };
}

function extractApiCallPaths(content) {
  const paths = [];
  const re = /(?:axios|api|apiClient|apiService|http|client|request)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    paths.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return paths;
}

function buildModuleTree(repoPath, name) {
  if (!fs.existsSync(repoPath)) return [];

  const exts = ['.js', '.jsx', '.ts', '.tsx'];
  const exclude = ['node_modules', 'android', 'ios', '.git', 'dist', 'build'];
  const files = walkDir(repoPath, exts, exclude);

  // Build directory tree
  const dirMap = {};
  for (const file of files) {
    const rel = path.relative(repoPath, file);
    const parts = rel.split(path.sep);
    if (parts.length < 2) continue;

    const topLevel = parts[0];
    const secondLevel = parts.length > 2 ? parts[1] : null;

    const key = secondLevel ? `${topLevel}/${secondLevel}` : topLevel;
    if (!dirMap[key]) {
      dirMap[key] = {
        dirPath: key,
        files: [],
        apiCalls: [],
      };
    }
    dirMap[key].files.push({ rel, file });
  }

  // Extract API calls per directory group
  for (const group of Object.values(dirMap)) {
    for (const { file } of group.files) {
      const content = readFileSafe(file);
      if (!content) continue;
      const calls = extractApiCallPaths(content);
      group.apiCalls.push(...calls);
    }
  }

  // Group into modules
  const moduleMap = {};

  for (const [dirPath, group] of Object.entries(dirMap)) {
    const dirLower = dirPath.toLowerCase();
    const category = classifyByKeyword(dirLower);
    const moduleKey = category;

    if (!moduleMap[moduleKey]) {
      moduleMap[moduleKey] = {
        id: moduleKey,
        name: MODULE_HINTS[moduleKey]?.label || dirPath,
        category: moduleKey,
        dirs: [],
        screens: [],
        components: [],
        services: [],
        apiEndpoints: [],
        fileCount: 0,
      };
    }

    const mod = moduleMap[moduleKey];
    mod.dirs.push(dirPath);
    mod.fileCount += group.files.length;

    for (const { rel, file } of group.files) {
      const compName = extractComponentName(file);
      const content = readFileSafe(file);
      if (!content) continue;

      const isScreen = /screen|page|view/i.test(compName) || /Screen|Page|View/.test(compName);
      const isService = /service|api|http|network/i.test(compName);
      const isComponent = !isScreen && !isService && /^[A-Z]/.test(compName);

      const entry = { name: compName, file: rel };

      if (isScreen) mod.screens.push(entry);
      else if (isService) mod.services.push(entry);
      else if (isComponent) mod.components.push(entry);

      // Collect unique API endpoints used in this module
      const calls = extractApiCallPaths(content);
      for (const call of calls) {
        const key = `${call.method}:${call.path}`;
        if (!mod.apiEndpoints.find(e => `${e.method}:${e.path}` === key)) {
          mod.apiEndpoints.push(call);
        }
      }
    }
  }

  // Flatten and sort by importance
  const modules = Object.values(moduleMap)
    .filter(m => m.fileCount > 0)
    .sort((a, b) => {
      const priority = ['auth', 'home', 'menu', 'cart', 'order', 'payment', 'profile', 'store', 'search'];
      const ai = priority.indexOf(a.category);
      const bi = priority.indexOf(b.category);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

  return modules;
}

async function scanModules(repos) {
  console.log('\n🔍 Scanning modules...\n');

  const frontendRepos = repos.filter(r => r.type === 'frontend');
  const allModules = {};

  for (const repo of frontendRepos) {
    if (!fs.existsSync(repo.localPath)) {
      console.log(`  [SKIP] ${repo.name} — path not found`);
      continue;
    }
    console.log(`→ Scanning ${repo.name}`);
    const modules = buildModuleTree(repo.localPath, repo.name);
    allModules[repo.name] = modules;
    console.log(`  [OK] Found ${modules.length} module groups`);
  }

  const result = {
    lastScanned: new Date().toISOString(),
    stats: {
      totalModules: Object.values(allModules).reduce((s, m) => s + m.length, 0),
      totalScreens: Object.values(allModules).reduce((s, m) => s + m.reduce((ss, mod) => ss + mod.screens.length, 0), 0),
      totalComponents: Object.values(allModules).reduce((s, m) => s + m.reduce((ss, mod) => ss + mod.components.length, 0), 0),
      totalServices: Object.values(allModules).reduce((s, m) => s + m.reduce((ss, mod) => ss + mod.services.length, 0), 0),
    },
    modules: allModules,
  };

  console.log(`\n✅ Done. ${result.stats.totalModules} module groups, ${result.stats.totalScreens} screens.`);
  return result;
}

module.exports = { scanModules };
