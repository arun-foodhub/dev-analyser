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
- Read `data/endpoints.json` to find candidate routes
- Use grep or node one-liners — do NOT browse the file manually:
  ```bash
  # Search by keyword
  node -e "
    const d = require('./data/endpoints.json');
    const q = 'KEYWORD';
    const r = d.endpoints.filter(e => e.path.includes(q) || e.file.includes(q));
    r.forEach(e => console.log(e.method, e.path, '→', e.repo, e.file + ':' + e.line));
  "
  ```
- Also check `d.frontendOnlyCalls` for calls with no backend match

### 3. Map endpoints to repos and files
For each endpoint found:
- Note `repo` — which backend service owns it
- Note `file` + `line` — exact location
- Note `matchedFrontendCalls` — which frontend file calls it, and from which line

### 4. Read the relevant files
Open only the specific files identified in step 3. Do NOT browse entire repos.
- Backend: use the `file` + `line` from the endpoint entry
- Frontend: use the `file` + `line` from `matchedFrontendCalls`
- If `data/` is stale (no scan in >2 days), run `npm run scan` first

### 5. Produce the action plan
Output format:
```
## Task: [description]

### Repos affected
- [repo name] ([technology]) — [what to change]

### Files to change
1. [repo]/[file]:[line] — [what and why]
2. [repo]/[file]:[line] — [what and why]

### API flow
[frontend file] → [method] [path] → [backend repo] [file]:[line]

### Notes
[edge cases, migration concerns, related endpoints]
```

## Shortcuts
- If the task clearly only affects the frontend (UI layout, navigation, styling) → skip step 2 and go straight to `data/modules.json`
- If the task clearly only affects a backend service and the path is known → skip to step 4
- For `foodhubglobal` tasks: this is standalone — ignore all other repos entirely

## Data sources available
- `data/endpoints.json` — 4,204 backend routes + 178 frontend calls + 1,426 matched pairs
- `data/modules.json` — 8 frontend modules, 217 screens
- `config/repos.json` — repo paths and tech stack
- Customer app `.memory/api-integration/API_ENDPOINTS.json` — 200 curated endpoints with mock payloads

## Hard rules
- ALWAYS check `data/endpoints.json` before opening any backend file — this saves 80% of search time
- NEVER assume which repo owns an endpoint — always verify from the scan data
- `foodhubglobal` is completely independent — never cross-reference it with other repos
- A "frontend only" call (in `frontendOnlyCalls`) means either the endpoint is in an unscanned repo or the path matching failed — investigate both possibilities
