---
name: scan
description: Run a fresh scan of all repos and report what was found, any new endpoints, and whether all repos were reachable. Use when the user asks to refresh data, re-scan, or wants to know the current state of the endpoint registry.
---

# Scan All Repos

Re-scan all repos and summarise results. Detects new routes, missing repos, and scanner health.

## Execution

### Step 1: Check repo availability first
```bash
node backend/cli.js status
```

If any repos are missing (○), note them — their routes won't be included.

### Step 2: Run the scan
```bash
npm run scan
```

This writes to `data/endpoints.json` and `data/modules.json`.

### Step 3: Report the results

After the scan completes, read the stats from the output and report:

```
## Scan Complete

### Results
| Repo | Routes | Status |
|------|--------|--------|
| t2s-api     | N | ✓ |
| t2s-mcs     | N | ✓ |
| falcon      | N | ✓ |
| falcon-payment-service | N | ✓ |
| foodhubglobal | N | ✓/✗ |

Frontend: N API calls (N from memory file, N from Network layer, N from regex)
Matched: N frontend calls → backend routes
Unmatched backend: N routes with no frontend caller
Frontend only: N calls with no matching backend route

### Notes
[List any repos that were skipped due to missing path]
[List if any repo returned 0 routes unexpectedly]
```

### Step 4: Flag anomalies
- A repo returning 0 routes when it previously had some → scanner pattern may have broken or the route file location changed. Check [[scanner-patterns]].
- `foodhubglobal` returning 0 is expected (route location not yet mapped).
- Frontend finding fewer than 100 calls → likely `.memory/api-integration/API_ENDPOINTS.json` is missing or empty in the frontend repo.

## Partial scans
- Endpoints only: `npm run scan:endpoints`
- Modules only: `npm run scan:modules`
- These are faster for targeted refreshes

## Triggering via API (for dashboard button)
```bash
curl -X POST http://localhost:3001/api/scan/all
curl -X POST http://localhost:3001/api/scan/endpoints
curl -X POST http://localhost:3001/api/scan/modules
```
