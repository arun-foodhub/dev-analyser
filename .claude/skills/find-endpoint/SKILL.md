---
name: find-endpoint
description: Look up a specific API endpoint across all repos — find where it is defined in the backend, which frontend files call it, and what the request/response shape looks like. Use when the user provides a path like /consumer/v1/orders or an endpoint name.
---

# Find Endpoint

Locate a specific API endpoint end-to-end: backend definition → frontend usage → payload shape.

## Execution

### Step 1: Search scan data
```bash
node -e "
  const d = require('./data/endpoints.json');
  const q = process.argv[1].toLowerCase();

  // Backend routes
  const be = d.endpoints.filter(e =>
    e.path.toLowerCase().includes(q) ||
    e.normalizedPath.toLowerCase().includes(q)
  );

  // Frontend only calls
  const fe = d.frontendOnlyCalls.filter(e =>
    e.path.toLowerCase().includes(q)
  );

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
" -- SEARCH_TERM
```

Replace `SEARCH_TERM` with the path segment the user provided.

### Step 2: Report what was found

For each matched backend route, report:
```
METHOD  /path/to/endpoint
  Backend:  [repo] [file]:[line]
  Frontend: [file]:[line]  →  [rawCall]
  Payload:  [mockPayload if available, else "not documented"]
  Response: [mockResponse if available, else "not documented"]
```

### Step 3: Open the files (if user wants to see the code)
Use the exact file paths and line numbers from step 2.

### Step 4: If not found in scan data
The endpoint may be in `foodhubglobal` (not connected to the main app) or the scan data may be stale.
- If stale: run `npm run scan:endpoints` first
- If `foodhubglobal`: search directly in that repo — it's a standalone PHP codebase
- If still not found: the endpoint may be defined dynamically or behind a framework layer not yet covered by the scanner

## What to output
- Exact file + line in the backend repo
- All frontend files that call it
- The mock payload/response if available from `.memory/api-integration/API_ENDPOINTS.json`
- The tech stack of the owning repo (so the user knows what language they're about to read)
