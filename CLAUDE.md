# Dev Analyser — Claude Context

This is a developer analysis tool for a food delivery platform. It scans and analyses all repos, builds an endpoint registry, and surfaces a dashboard for debugging, feature development, and architecture understanding.

## Repo Map

### Frontend
| Repo | Path | Tech | Notes |
|------|------|------|-------|
| customer_app_2.0 | /Users/arun/Desktop/Workspace/customer_app_2.0 | React Native | Customer mobile app. Branches: main |

### Backend (all serve APIs consumed by the frontend)
| Repo | Path | Tech | Priority | Notes |
|------|------|------|----------|-------|
| t2s-api | /Users/arun/Desktop/Workspace/t2s-api | Node.js | HIGH | Primary API layer for frontend |
| falcon | /Users/arun/Desktop/Workspace/falcon | PHP | HIGH | Falcon backend service |
| falcon-payment-service | /Users/arun/Desktop/Workspace/falcon-payment-service | Node.js | MEDIUM | Payment service |
| t2s-mcs | /Users/arun/Desktop/Workspace/t2s-mcs | Node.js | HIGH | Microservices layer |

### Monolith (standalone — NOT connected to any other repo)
| Repo | Path | Tech | Notes |
|------|------|------|-------|
| foodhubglobal | /Users/arun/Desktop/Workspace/foodhubglobal | PHP | Frontend + backend in same repo. Does NOT integrate with any other repo |

## Architecture Notes
- `t2s-api`, `falcon`, `t2s-mcs` are the three primary API providers for the mobile app
- `falcon-payment-service` handles payment flows
- `foodhubglobal` is completely independent — analyse it separately when working on monolith tasks
- Backend repos may call each other internally but all frontend API traffic goes through the above 4

## This Repo Structure
```
dev-analyser/
├── CLAUDE.md            ← you are here
├── config/repos.json    ← repo registry (paths, tech, priority)
├── backend/             ← Express server + scanners
│   ├── server.js        ← API server (port 3001)
│   ├── cli.js           ← CLI entry point
│   └── scanners/        ← endpoint + module scanners
├── frontend/            ← React dashboard (port 5173 dev / served from 3001 in prod)
│   └── src/
│       ├── pages/       ← EndpointsPage, ModulesPage, DashboardPage, ReposPage
│       └── components/  ← Shared UI components
├── data/                ← Generated JSON (gitignored)
│   ├── endpoints.json
│   └── modules.json
└── package.json         ← Root: `npm run dev`, `npm run scan`, etc.
```

## Common Commands
```bash
npm run dev          # Start both backend + frontend dev servers
npm run scan         # Scan all repos (endpoints + modules)
npm run scan:endpoints  # Scan endpoints only
npm run scan:modules    # Scan modules only
npm run build        # Build frontend for production
npm start            # Production mode (serves built frontend from backend)
```

## How to Work on a Bug / Feature
1. If task is frontend: check `customer_app_2.0` → look up module in Modules dashboard
2. If task is backend: check which API endpoints are involved → look up in Endpoints dashboard to find which repo/file owns it
3. If task touches both: use endpoint matching to trace frontend call → backend handler
4. foodhubglobal: work entirely within that repo, no cross-repo impact

## Tech Stack Per Repo
- React Native apps: JavaScript/TypeScript, uses Axios for HTTP
- Node.js backends (t2s-api, t2s-mcs, falcon-payment-service): Express.js, likely routes in `routes/` or `src/routes/`
- PHP backends (falcon, foodhubglobal): likely Laravel or Slim, routes in `routes/api.php` or similar
