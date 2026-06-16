---
name: analyse
description: Given a bug description, Jira ticket, or feature request, identify which repos and files are involved, trace the API path end-to-end, and produce a concrete action plan. Use whenever a task mentions a bug, feature, or flow that spans the mobile app and/or any backend repo.
---

# Dev Analyser — Cross-Repo Analysis

Use this skill to take any task description (bug, ticket, feature) and produce a precise, repo-specific action plan.

## Inputs accepted
- A bug description ("users can't complete checkout")
- A Jira ticket summary or description
- A feature request ("add loyalty points display to order confirmation")
- A flow description ("trace what happens when a user places an order")

## Step-by-step execution

### 1. Classify the task
Determine: is this frontend, backend, or both?
- Frontend symptoms (UI, navigation, display bugs) → start in `customer_app_2.0`
- API errors, data issues, performance → start in backend repos
- Most features touch both

### 2. Identify API endpoints involved
```bash
node -e "
  const d = require('./data/endpoints.json');
  const q = 'KEYWORD';
  const r = d.endpoints.filter(e => e.path.includes(q) || e.file.includes(q));
  r.forEach(e => console.log(e.method, e.path, '→', e.repo, e.file + ':' + e.line));
"
```
Also check `d.frontendOnlyCalls` for calls with no backend match.

### 3. For t2s-api endpoints — identify the owning module
```bash
node -e "
  const d = require('./data/api-modules.json');
  const t = d.modules['t2s-api'] || [];
  t.forEach(m => m.controllers.forEach(c => {
    if (c.name.toLowerCase().includes('KEYWORD'))
      console.log(m.name, '→', c.name, c.file, c.methods.join(', '));
  }));
"
```
This tells you which controller handles the logic and which repository/service it uses.

### 4. For frontend — identify the owning module
```bash
node -e "
  const d = require('./data/modules.json');
  const mods = d.modules['customer_app_2.0'] || [];
  mods.forEach(m => {
    const hit = m.screens.some(s => s.name.toLowerCase().includes('KEYWORD'))
             || m.components.some(c => c.name.toLowerCase().includes('KEYWORD'));
    if (hit) console.log(m.name, m.dirs.join(', '));
  });
"
```

### 5. Map endpoints to repos and files
For each endpoint found:
- Note `repo` — which backend service owns it
- Note `file` + `line` — exact location
- Note `matchedFrontendCalls` — which frontend file calls it

### 6. Read the relevant files
Open only the specific files identified above. Do NOT browse entire repos.

### 7. Produce the action plan
```
## Task: [description]

### Repos affected
- [repo name] ([technology]) — [what to change]

### Files to change
1. [repo]/[file]:[line] — [what and why]
2. [repo]/[file]:[line] — [what and why]

### API flow
[frontend file] → [method] [path] → [backend repo] [file]:[line] → [controller method]

### Notes
[edge cases, migration concerns, related endpoints]
```

## Shortcuts
- Frontend-only task (UI, styling) → go straight to `data/modules.json` (28 module groups, 217 screens)
- Backend task with known path → skip to step 5
- `foodhubglobal` tasks → completely standalone, ignore all other repos entirely

## Data sources
| File | Contains | Key fields |
|------|---------|-----------|
| `data/endpoints.json` | ~4,200 backend routes + ~178 frontend calls + ~1,426 matched | `repo`, `file`, `line`, `matchedFrontendCalls` |
| `data/modules.json` | customer_app_2.0 — 28 module groups, 217 screens | `screens`, `components`, `apiEndpoints` |
| `data/api-modules.json` | t2s-api — 21 modules, 58 controllers, 47 repos | `controllers[].methods`, `repositories`, `endpoints` |
| `config/repos.json` | repo paths and tech stack | `localPath`, `technology`, `type` |

## Hard rules
- ALWAYS check `data/endpoints.json` before opening any backend file
- NEVER assume which repo owns an endpoint — always verify from scan data
- `foodhubglobal` is completely independent — never cross-reference it with other repos
- A "frontend only" call means either the endpoint is in an unscanned repo or path matching failed
- t2s-api old version dirs (`v2018_06_12` etc.) are excluded from scan — if a route is missing, check that it's in `v2025_03_17`
