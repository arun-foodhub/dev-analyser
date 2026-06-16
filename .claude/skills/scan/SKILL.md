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

This writes to:
- `data/endpoints.json` — all backend routes + frontend calls + matched pairs
- `data/modules.json` — customer_app_2.0 feature modules (28 groups)
- `data/api-modules.json` — t2s-api semantic modules (controllers, repositories, services)

### Step 3: Report the results

```
## Scan Complete

### Endpoints
| Repo | Routes | Status |
|------|--------|--------|
| t2s-api (current version only) | N | ✓ |
| t2s-mcs     | N | ✓ |
| falcon      | N | ✓ |
| falcon-payment-service | N | ✓ |
| foodhubglobal | N | ✓/✗ |

Frontend: N API calls (N from memory file, N from Network layer, N from regex)
Matched: N frontend calls → backend routes
Unmatched backend: N routes with no frontend caller
Frontend only: N calls with no matching backend route

### App Modules (customer_app_2.0)
N module groups, N screens, N components, N services

### API Modules (t2s-api)
N modules, N controllers, N repositories, N services, N endpoints
```

### Step 4: Flag anomalies
- A repo returning 0 routes when it previously had some → scanner pattern may have broken or route file location changed. Check [[scanner-patterns]].
- `foodhubglobal` returning 0 is expected (route location not yet mapped).
- Frontend finding fewer than 100 calls → `.memory/api-integration/API_ENDPOINTS.json` may be missing.
- t2s-api returning far more routes than ~670 → old version dirs may not be excluded. Check `php-lumen` exclude list in `endpoint-scanner.js`.
- Module scanner returning fewer than 28 groups → 3-level directory key logic may have regressed.

## Partial scans (faster for targeted refreshes)
```bash
npm run scan:endpoints    # endpoints only → data/endpoints.json
npm run scan:modules      # customer app modules → data/modules.json
npm run scan:api-modules  # t2s-api modules → data/api-modules.json (reads existing endpoints.json)
```

Note: `scan:api-modules` depends on `data/endpoints.json` for matching endpoints to modules. Run `scan:endpoints` first if endpoints data is stale.

## Triggering via API (for dashboard buttons)
```bash
curl -X POST http://localhost:3001/api/scan/all
curl -X POST http://localhost:3001/api/scan/endpoints
curl -X POST http://localhost:3001/api/scan/modules
curl -X POST http://localhost:3001/api/scan/api-modules
```
