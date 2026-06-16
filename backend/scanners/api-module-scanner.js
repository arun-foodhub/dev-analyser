const fs = require('fs');
const path = require('path');

// Version folders to ignore — old/deprecated API versions
const SKIP_VERSION_DIRS = new Set(['v2018_06_12', 'v2019_08_27', 'v2020_10_05', 'v2021_02_25', 'v2022_05_05']);

const API_MODULE_HINTS = {
  auth:         { keywords: ['auth', 'login', 'register', 'enroll', 'otp', 'verify', 'password', 'token', 'oauth', 'smooth'], label: 'Authentication' },
  order:        { keywords: ['order', 'checkout', 'cashandcarry', 'cashndcarry', 'cashcarry'], label: 'Orders & Checkout' },
  cart:         { keywords: ['cart', 'basket', 'bag', 'addonselection', 'addon'], label: 'Cart & Add-ons' },
  menu:         { keywords: ['menu', 'cuisine', 'food', 'item', 'product', 'catalogue', 'catalog', 'dish', 'menupricing', 'priceuplift'], label: 'Menu & Catalogue' },
  payment:      { keywords: ['payment', 'pay', 'card', 'wallet', 'billing', 'transaction', 'gocardless', 'stripe', 'paymentservice'], label: 'Payments' },
  store:        { keywords: ['store', 'restaurant', 'vendor', 'shop', 'outlet', 'openhour', 'open_hour', 'website'], label: 'Store Management' },
  customer:     { keywords: ['customer', 'consumer', 'user', 'profile', 'account', 'gdpr', 'consumerrequest'], label: 'Customers & Accounts' },
  driver:       { keywords: ['driver', 'delivery', 'dispatch', 'courier', 'globaldriver', 'deliveryzone', 'deliverymile', 'deliveryrepository'], label: 'Drivers & Delivery' },
  location:     { keywords: ['location', 'address', 'geo', 'postcode', 'map', 'googlegeo', 'googlegeoaddresslookup', 'timezone'], label: 'Location & Address' },
  loyalty:      { keywords: ['loyalty', 'reward', 'point', 'loyaltypoint', 'giftcard', 'gift_card', 'savings'], label: 'Loyalty & Rewards' },
  offers:       { keywords: ['offer', 'coupon', 'discount', 'deal', 'promo', 'flash', 'flashsale', 'flash_sale', 'flashsaleservice'], label: 'Offers & Promotions' },
  notifications:{ keywords: ['notify', 'notification', 'sms', 'mail', 'email', 'push', 'alert', 'announce', 'announcement', 'television', 'pushnotify'], label: 'Notifications & Alerts' },
  dinein:       { keywords: ['dine', 'dinein', 'table', 'booking', 'reservation', 'kiosk', 'tablebooking', 'table_booking'], label: 'Dine-In & Table Booking' },
  staff:        { keywords: ['staff', 'admin', 'employee', 'operator'], label: 'Staff & Admin' },
  devices:      { keywords: ['device', 'deviceregistration', 'deviceanalytic', 'mypos', 'pos', 'hardware', 'analytic'], label: 'Devices & Analytics' },
  integrations: { keywords: ['sync', 'hook', 'fusion', 'google', 'bigfoodie', 'foodhub', 'webhook', 'integration', 'epos', 'appsync'], label: 'Integrations & Webhooks' },
  review:       { keywords: ['review', 'rating', 'feedback'], label: 'Reviews & Ratings' },
  uploads:      { keywords: ['upload', 'file', 'media', 'image', 'asset'], label: 'File Uploads' },
  tasks:        { keywords: ['task', 'job', 'queue', 'schedule', 'cron', 'background', 'reason'], label: 'Background Tasks' },
  cms:          { keywords: ['website', 'domain', 'portal', 'cms', 'content', 'page', 'static', 'domain', 'blog'], label: 'CMS & Website' },
};

const MODULE_PRIORITY = [
  'auth', 'order', 'cart', 'menu', 'payment', 'store', 'customer', 'driver',
  'location', 'loyalty', 'offers', 'notifications', 'dinein', 'review',
  'staff', 'devices', 'integrations', 'uploads', 'tasks', 'cms',
];

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function classifyByKeyword(nameLower) {
  for (const [key, { keywords }] of Object.entries(API_MODULE_HINTS)) {
    if (keywords.some(kw => nameLower.includes(kw))) return key;
  }
  return 'other';
}

function extractPublicMethods(phpContent) {
  const methods = [];
  const re = /public\s+function\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(phpContent)) !== null) {
    methods.push(m[1]);
  }
  return methods.filter(n => !['__construct', '__destruct'].includes(n));
}

function walkPhpFiles(dirPath, subDir) {
  const results = [];
  const target = path.join(dirPath, subDir);
  if (!fs.existsSync(target)) return results;

  function walk(current, depth = 0) {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip old version dirs at the top level of app/Http/
        if (SKIP_VERSION_DIRS.has(entry.name)) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.php')) {
        results.push(fullPath);
      }
    }
  }
  walk(target);
  return results;
}

function buildApiModulesForRepo(repo, repoEndpoints) {
  const { localPath, name } = repo;
  const moduleMap = {};

  function getOrCreateModule(category) {
    if (!moduleMap[category]) {
      moduleMap[category] = {
        id: category,
        name: API_MODULE_HINTS[category]?.label || category,
        category,
        controllers: [],
        services: [],
        repositories: [],
        endpoints: [],
        endpointCount: 0,
      };
    }
    return moduleMap[category];
  }

  // --- Controllers ---
  const controllerFiles = walkPhpFiles(localPath, 'app/Http').filter(f => f.includes('/Controllers/'));

  for (const file of controllerFiles) {
    const controllerName = path.basename(file, '.php');
    if (controllerName === 'Controller') continue;

    const nameLower = controllerName.toLowerCase().replace('controller', '');
    const category = classifyByKeyword(nameLower);
    const mod = getOrCreateModule(category);

    const content = readFileSafe(file);
    const methods = content ? extractPublicMethods(content) : [];
    const relPath = path.relative(localPath, file);

    mod.controllers.push({ name: controllerName, file: relPath, methodCount: methods.length, methods });
  }

  // --- Services ---
  const serviceFiles = walkPhpFiles(localPath, 'app/Http').filter(f => f.includes('/Services/'));

  for (const file of serviceFiles) {
    const serviceName = path.basename(file, '.php');
    const nameLower = serviceName.toLowerCase().replace('service', '');
    const category = classifyByKeyword(nameLower);
    const relPath = path.relative(localPath, file);

    if (moduleMap[category]) {
      moduleMap[category].services.push({ name: serviceName, file: relPath });
    } else {
      // Place in 'other' if the module doesn't exist yet
      getOrCreateModule('other').services.push({ name: serviceName, file: relPath });
    }
  }

  // --- Repositories ---
  const repositoryFiles = walkPhpFiles(localPath, 'app/Http').filter(f => f.includes('/Repositories/'));

  for (const file of repositoryFiles) {
    const repoName = path.basename(file, '.php');
    const nameLower = repoName.toLowerCase().replace('repository', '');
    const category = classifyByKeyword(nameLower);
    const relPath = path.relative(localPath, file);

    if (moduleMap[category]) {
      moduleMap[category].repositories.push({ name: repoName, file: relPath });
    } else {
      getOrCreateModule(category).repositories.push({ name: repoName, file: relPath });
    }
  }

  // --- Endpoints (from pre-scanned data, skip old version files) ---
  for (const ep of repoEndpoints) {
    // Skip endpoints from version dirs we want to ignore
    const fileDir = ep.file || '';
    const isOldVersion = [...SKIP_VERSION_DIRS].some(v => fileDir.includes(v));
    if (isOldVersion) continue;

    // Classify by path keywords
    const pathLower = ep.path.toLowerCase();
    let category = null;

    // Try to match by controller from path prefix (e.g. 'order/', 'cart/')
    for (const [key, { keywords }] of Object.entries(API_MODULE_HINTS)) {
      if (keywords.some(kw => pathLower.includes(kw))) {
        category = key;
        break;
      }
    }
    if (!category) category = 'other';

    const mod = getOrCreateModule(category);
    const epKey = `${ep.method}:${ep.normalizedPath}`;
    if (!mod.endpoints.find(e => `${e.method}:${e.normalizedPath}` === epKey)) {
      mod.endpoints.push({
        method: ep.method,
        path: ep.path,
        normalizedPath: ep.normalizedPath,
        file: ep.file,
        line: ep.line,
        matchedFrontendCalls: ep.matchedFrontendCalls || [],
      });
    }
  }

  // Finalize
  for (const mod of Object.values(moduleMap)) {
    mod.endpointCount = mod.endpoints.length;
  }

  // Sort endpoints within each module by method then path
  for (const mod of Object.values(moduleMap)) {
    mod.endpoints.sort((a, b) => a.path.localeCompare(b.path));
  }

  return Object.values(moduleMap)
    .filter(m => m.controllers.length > 0 || m.endpoints.length > 0 || m.repositories.length > 0)
    .sort((a, b) => {
      const ai = MODULE_PRIORITY.indexOf(a.category);
      const bi = MODULE_PRIORITY.indexOf(b.category);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
}

async function scanApiModules(repos, endpointsData) {
  console.log('\n🔍 Scanning API modules...\n');

  const endpoints = endpointsData?.endpoints || [];
  const allModules = {};

  for (const repo of repos) {
    if (repo.technology !== 'php-lumen') continue;
    if (!fs.existsSync(repo.localPath)) {
      console.log(`  [SKIP] ${repo.name} — path not found`);
      continue;
    }

    console.log(`→ Scanning ${repo.name}`);
    const repoEndpoints = endpoints.filter(e => e.repo === repo.name);
    const modules = buildApiModulesForRepo(repo, repoEndpoints);
    allModules[repo.name] = modules;

    const totalEps = modules.reduce((s, m) => s + m.endpointCount, 0);
    const totalControllers = modules.reduce((s, m) => s + m.controllers.length, 0);
    console.log(`  [OK] ${modules.length} modules, ${totalControllers} controllers, ${totalEps} endpoints`);
  }

  const flat = Object.values(allModules).flat();

  const result = {
    lastScanned: new Date().toISOString(),
    stats: {
      totalModules: flat.length,
      totalControllers: flat.reduce((s, m) => s + m.controllers.length, 0),
      totalRepositories: flat.reduce((s, m) => s + m.repositories.length, 0),
      totalServices: flat.reduce((s, m) => s + m.services.length, 0),
      totalEndpoints: flat.reduce((s, m) => s + m.endpointCount, 0),
    },
    modules: allModules,
  };

  console.log(`\n✅ Done. ${result.stats.totalModules} modules, ${result.stats.totalEndpoints} endpoints mapped.`);
  return result;
}

module.exports = { scanApiModules };
