---
name: find-endpoint
description: Look up a specific API endpoint across all repos — find where it is defined in the backend, which frontend files call it, what controller/method handles it, and what the request/response shape looks like. Use when the user provides a path like /consumer/v1/orders or an endpoint name.
---

# Find Endpoint

Locate a specific API endpoint end-to-end: backend definition → frontend usage → controller method → payload shape.

## Execution

### Step 1: Search scan data
```bash
node -e "
  const d = require('./data/endpoints.json');
  const q = 'SEARCH_TERM'.toLowerCase();

  const be = d.endpoints.filter(e =>
    e.path.toLowerCase().includes(q) ||
    e.normalizedPath.toLowerCase().includes(q)
  );
  const fe = d.frontendOnlyCalls.filter(e => e.path.toLowerCase().includes(q));

  console.log('=== Backend routes (' + be.length + ') ===');
  be.forEach(e => {
    console.log(e.method, e.path);
    console.log('  repo:', e.repo, '|', e.file + ':' + e.line);
    if (e.matchedFrontendCalls.length) {
      console.log('  frontend uses:');
      e.matchedFrontendCalls.forEach(fc => console.log('   ', fc.file + ':' + fc.line, fc.rawCall));
    }
    console.log();
  });

  console.log('=== Frontend only (' + fe.length + ') ===');
  fe.forEach(e => console.log(e.method, e.path, '|', e.file + ':' + e.line));
"
```

### Step 2: For t2s-api routes — find the owning controller
```bash
node -e "
  const d = require('./data/api-modules.json');
  const t = d.modules['t2s-api'] || [];
  const q = 'SEARCH_TERM'.toLowerCase();
  t.forEach(m => {
    const eps = m.endpoints.filter(e => e.path.toLowerCase().includes(q));
    if (eps.length) {
      console.log('Module:', m.name);
      console.log('Controllers:', m.controllers.map(c => c.name).join(', '));
      eps.forEach(e => console.log(' ', e.method, e.path, e.file + ':' + e.line));
    }
  });
"
```

### Step 3: Report what was found
```
METHOD  /path/to/endpoint
  Backend:    [repo] [file]:[line]
  Controller: [ControllerName] → [methodName()] (t2s-api only)
  Module:     [semantic module name, e.g. "Orders & Checkout"]
  Frontend:   [file]:[line]  →  [rawCall]
  Payload:    [mockPayload if available, else "not documented"]
  Response:   [mockResponse if available, else "not documented"]
```

### Step 4: Open the files (if user wants to see the code)
Use the exact file paths and line numbers from above.

### Step 5: If not found in scan data
- **Stale data**: run `npm run scan:endpoints` first
- **t2s-api old version**: route may only exist in an old version dir (`v2018_06_12` etc.) — these are excluded from scan by design
- **foodhubglobal**: search directly in that standalone PHP repo — it's not in scan data
- **Dynamic routes**: endpoint may be defined dynamically or behind a framework layer not covered by the scanner

## What to output
- Exact file + line in the backend repo
- All frontend files that call it
- The semantic module it belongs to (from `data/api-modules.json`) if in t2s-api
- The controller + method that handles it
- The mock payload/response if available from `.memory/api-integration/API_ENDPOINTS.json`
- The tech stack of the owning repo (so the user knows what language they're reading)
