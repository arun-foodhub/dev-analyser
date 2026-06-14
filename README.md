# Dev Analyser — FoodHub Platform

Cross-repo developer analysis tool. Scans all FoodHub repos, builds an API endpoint registry, and surfaces a searchable dashboard for debugging, tracing features, and understanding architecture across the full stack.

---

## Quick Start

```bash
# First-time setup
npm run setup

# Start dashboard + API server
npm run dev
# → Dashboard: http://localhost:5173
# → API:       http://localhost:3001/api

# Run a full scan (updates data/ from all repos)
npm run scan
```

---

## Repos Covered

| Repo | Path | Tech | Role |
|------|------|------|------|
| `customer_app_2.0` | `../customer_app_2.0` | React Native | Frontend — customer mobile app |
| `t2s-api` | `../t2s-api` | PHP Lumen | **PRIMARY** backend API |
| `t2s-mcs` | `../t2s-mcs` | Node.js/Express | **PRIMARY** microservices |
| `falcon` | `../falcon` | AWS CDK TypeScript | **PRIMARY** serverless backend |
| `falcon-payment-service` | `../falcon-payment-service` | Node.js TypeScript | Payment service |
| `foodhubglobal` | `../foodhubglobal` | PHP | Standalone monolith — no cross-repo deps |

> `t2s-api`, `t2s-mcs`, and `falcon` are the three primary API providers for the mobile app. `foodhubglobal` is completely independent.

---

## CLI Commands

```bash
npm run scan               # Full scan: endpoints + modules
npm run scan:endpoints     # Backend routes + frontend API calls only
npm run scan:modules       # Frontend module structure only
npm run status             # Check which repos exist locally
npm run dev                # Start both API server and React dashboard in dev mode
npm run build              # Build the dashboard for production
npm start                  # Production mode (serves built dashboard from API server)
```

---

## Dashboard Pages

### Dashboard (Home)
- Repo availability status — shows which are cloned locally
- Stats: total backend routes, frontend calls, matched pairs
- Scan trigger button
- Quick reference for CLI commands and architecture

### API Endpoints
Search and filter all API endpoints across every backend repo and every API call in the frontend.

**Filters:**
- **Search** — path, file name, or repo name
- **Method** — GET / POST / PUT / PATCH / DELETE
- **Repo** — filter to a specific backend repo
- **Unmatched only** — show backend routes that have no matching frontend call

**Tabs:**
- `Backend Routes` — all routes defined in backend repos, with matched frontend usages
- `Frontend Only` — API calls made by the app that couldn't be matched to a backend route

**Expand a row** to see:
- Full file path + line number
- Matched frontend usages (file, line, raw call)
- Mock payload and response (when available from `.memory` file)

### App Modules
Frontend codebase broken down by feature area. Each module card shows:
- Screens / components / services in that area
- API endpoints used within the module
- Folder paths

**Module categories:** Auth, Home, Menu, Cart & Checkout, Orders & Tracking, Payments, Profile & Settings, Store, Search, Notifications, Support, Navigation, State Management, Utilities

### Repos
All repos with their local path, availability status, tech stack, and clone commands for any that are missing.

---

## How Scanning Works

### Backend route detection
| Tech | Pattern detected |
|------|-----------------|
| PHP Lumen (`t2s-api`) | `$router->get('path', ...)` in `app/Http/v*/routes.php` |
| Node.js (`t2s-mcs`) | `router.get('path', ...)`, `app.post(...)` |
| TypeScript Express (`falcon-payment-service`) | `*Routes.post('path', ...)` |
| AWS CDK TypeScript (`falcon`) | `.addResource('path').addMethod('GET', ...)` |
| PHP Laravel (`foodhubglobal`) | `Route::get('path', ...)` |

### Frontend API call detection (customer_app_2.0)
Priority order — first source wins:
1. **`.memory/api-integration/API_ENDPOINTS.json`** — curated 200-endpoint registry with mock payloads (maintained by Claude agents)
2. **`old_code/AppModules/*/Network/*.js`** — the `url:` property in Network layer objects
3. **Regex scan** — `axios.get(...)`, `api.post(...)`, `fetch(...)` across all source files

### Matching
A frontend call and a backend route are matched when their normalized paths are equal (after replacing `:id`/`{id}` style params with `:param`). Suffix matching is also applied to handle base-URL differences.

---

## Project Structure

```
dev-analyser/
├── CLAUDE.md                    ← Claude AI context (architecture, commands, patterns)
├── README.md                    ← this file
├── config/
│   └── repos.json               ← repo registry (edit to add/remove repos)
├── backend/
│   ├── server.js                ← Express API server (port 3001)
│   ├── cli.js                   ← CLI entry point
│   └── scanners/
│       ├── endpoint-scanner.js  ← backend route + frontend API call scanner
│       └── module-scanner.js    ← frontend module structure scanner
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.jsx
│       │   ├── EndpointsPage.jsx
│       │   ├── ModulesPage.jsx
│       │   └── ReposPage.jsx
│       └── components/
│           ├── Sidebar.jsx
│           ├── MethodBadge.jsx
│           └── ScanButton.jsx
├── data/                        ← generated, gitignored
│   ├── endpoints.json           ← scan output: backend routes + frontend calls
│   └── modules.json             ← scan output: frontend module map
└── package.json                 ← root scripts
```

---

## API Reference

The backend (port 3001) exposes these endpoints consumed by the dashboard:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/repos` | Repo config + local availability status |
| GET | `/api/endpoints` | Full endpoints data (from last scan) |
| GET | `/api/modules` | Full modules data (from last scan) |
| POST | `/api/scan/all` | Trigger full scan → returns stats |
| POST | `/api/scan/endpoints` | Trigger endpoint scan only |
| POST | `/api/scan/modules` | Trigger module scan only |

---

## Adding a New Repo

1. Edit `config/repos.json` — add a new entry:
```json
{
  "name": "new-service",
  "displayName": "New Service",
  "type": "backend",
  "technology": "nodejs",
  "gitUrl": "https://github.com/uktech/new-service.git",
  "localPath": "/Users/arun/Desktop/Workspace/new-service",
  "description": "What this service does",
  "color": "#6366F1",
  "priority": "medium",
  "standalone": false
}
```

2. Update `CLAUDE.md` to describe the new repo's role and patterns.
3. Run `npm run scan` to include it in the dashboard.

**Supported `technology` values:** `nodejs`, `nodejs-ts`, `php`, `php-lumen`, `aws-cdk-ts`, `react-native`

---

## Debugging Workflow

When investigating a bug or building a feature:

1. **Identify the API endpoint** involved — use the Endpoints dashboard, filter by method or search the path
2. **Find which backend repo owns it** — the table shows repo + file + line number
3. **See which frontend code calls it** — expand the row to see all frontend usages
4. **Understand the module context** — use the Modules dashboard to see what feature area it belongs to
5. **Navigate directly** to the file using the path shown in the dashboard

> Run `npm run scan` before starting a new bug investigation to ensure the data is fresh.

---

## First Scan Results

Scanned 2026-06-14:
- **4,204** backend routes across all repos
- **178** frontend API calls
- **1,426** matched frontend→backend route pairs
- **8** frontend module groups (217 screens)
