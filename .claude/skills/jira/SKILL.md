---
name: jira
description: Fetch a JIRA ticket, analyse it, auto-generate a checkbox task file, execute tasks one by one with confirmation, then create a PR. Usage: /jira TICKET-ID
---

# JIRA Workflow

Full lifecycle: fetch → analyse → task file → confirm additions → execute with confirmation → JIRA update → PR.

## Usage

```
/jira TICKET-ID
```

---

## Phase 1 — Fetch the Ticket

```
mcp__claude_ai_Atlassian_Rovo__getJiraIssue {
  cloudId: "aad7aca9-b132-481e-b559-63786aec8cd7",
  issueIdOrKey: "TICKET-ID",
  responseContentFormat: "markdown"
}
```

`cloudId` is for `touch2success.atlassian.net`. Never use `foodhub.atlassian.net`.

Extract: `key`, `fields.summary`, `fields.description`, `fields.status.name`, `fields.issuetype.name`, `fields.priority.name`, `fields.assignee.displayName`, `fields.reporter.displayName`, labels, comments.

Display a concise ticket summary.

---

## Phase 2 — Analyse the Requirement

1. Search `data/endpoints.json` for relevant routes:
   ```bash
   node -e "
     const d = require('./data/endpoints.json');
     d.endpoints.filter(e => e.path.toLowerCase().includes('KEYWORD'))
       .forEach(e => console.log(e.method, e.path, '|', e.repo, '|', e.file + ':' + e.line));
   "
   ```
2. Check `data/modules.json` and `data/api-modules.json` for relevant modules
3. Read specific files if needed for deeper understanding
4. Classify:
   - Frontend only → `customer_app_2.0`
   - Backend only → `t2s-api` / `falcon` / `t2s-mcs` / `falcon-payment-service`
   - FoodHub Global → `foodhubglobal` (completely isolated — never cross-reference)
   - Cross-repo → identify both sides

Write a 3–8 sentence analysis covering: what the ticket asks for, which repos/files are involved, the technical approach, and any risks or edge cases.

---

## Phase 3 — Generate Task File

Break the work into concrete, ordered, executable tasks. Each task must be:
- **Specific** — one thing to change or implement
- **Repo-labelled** — which repo it lives in

### 3a. Create the task file

Create the file at `tasks/TICKET-ID.md` (e.g. `tasks/FHDB-57844.md`):

```markdown
# TICKET-ID — Title

**Status:** [status]
**Priority:** [priority]
**Assignee:** [assignee]
**Ticket:** [url]

## Analysis

[3–8 sentence analysis]

## Tasks

[ ] Task description — repo-name
[ ] Task description — repo-name
[ ] Task description — repo-name
```

Task line format is strictly: `[ ] description — repo-name`

After writing the file, display the full task list to the user, numbered for readability:
```
1. [ ] Task description — repo-name
2. [ ] Task description — repo-name
```

### 3b. Ask for additions

> "Task file created at `tasks/TICKET-ID.md`. Would you like to add any more tasks before we start? List them or say 'no'."

If the user adds tasks, append them to the `## Tasks` section of the file (as `[ ]` lines) and confirm.

### 3c. Ask for permission to proceed

> "Ready to start execution? (yes / no)"

- **yes** → proceed to Phase 4
- **no** → stop. Tell the user: "Tasks saved in `tasks/TICKET-ID.md`. Resume any time with `/jira TICKET-ID` or say 'continue tasks'."

---

## Phase 4 — Save Session to Backend

Save the task plan to the dev-analyser backend for dashboard tracking:

```bash
curl -s -X POST http://localhost:3001/api/jira/session \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "TICKET-KEY",
    "ticketTitle": "...",
    "ticketDescription": "...",
    "ticketStatus": "...",
    "ticketType": "...",
    "ticketPriority": "...",
    "ticketUrl": "...",
    "assignee": "...",
    "reporter": "...",
    "analysis": "YOUR ANALYSIS TEXT",
    "tasks": [
      {"title": "Task description", "description": "...", "repo": "repo-name", "area": "area"},
      ...
    ]
  }'
```

Confirm `{"ok":true}`. Tell the user: "You can track progress at http://localhost:5173/jira"

---

## Phase 5 — Execute Tasks One by One

Read the task file to get the current list. Work through each `[ ]` task in order.

### 5a. Present the task

```
─────────────────────────────────────────────
Task [N/TOTAL]: [description]
Repo: [repo-name]
─────────────────────────────────────────────
```

### 5b. Ask for confirmation

> "Ready to execute task [N]? (yes / skip / stop)"

- **yes** → execute
- **skip** → mark `[-]` in file (skipped), update backend to `skipped`, move to next
- **stop** → pause. Tell the user: "Paused at task [N]. Resume with 'continue tasks'."

### 5c. Execute

- Read the relevant file(s) first
- Make targeted, minimal changes
- Run scan if the change affects scanned data:
  ```bash
  npm run scan:endpoints      # backend routes changed
  npm run scan:modules        # customer app components changed
  npm run scan:foodhubglobal  # foodhubglobal changed
  ```

### 5d. Mark complete in BOTH places

**1. Update the task file** — replace `[ ]` with `[x]` for the completed task:
```
[x] Task description — repo-name
```

**2. Update the backend session:**
```bash
# First get the task ID
curl -s http://localhost:3001/api/jira/session | python3 -m json.tool

# Then mark complete
curl -s -X PATCH http://localhost:3001/api/jira/tasks/TASK-ID \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

Report: "✓ Task [N] complete — [one sentence on what changed]"

### 5e. Move to next

Proceed to the next `[ ]` task automatically. Repeat 5a–5d.

---

## Phase 6 — Push Analysis to JIRA

When all tasks are done (or on user request "push to JIRA"):

```bash
curl -s -X POST http://localhost:3001/api/jira/push-analysis
```

This posts the analysis + task checklist as a JIRA comment.

---

## Phase 7 — Final Implementation Comment

Ask the user:
> "All tasks complete. Any implementation notes to add to the JIRA ticket? (e.g. what changed, caveats, follow-up items — or say 'skip')"

If they provide notes:
```bash
curl -s -X POST http://localhost:3001/api/jira/add-comment \
  -H "Content-Type: application/json" \
  -d '{"notes": "USER NOTES HERE"}'
```

Confirm: "✓ Implementation notes added to JIRA ticket [TICKET-KEY]"

---

## Phase 8 — Create Pull Request

After all tasks are done and JIRA is updated, prompt the user:

> "Ready to create a PR? Tell me:
> 1. The branch name you've been working on (or I'll detect it from git)
> 2. The target branch to PR against (e.g. `main`, `develop`, `staging`)"

Then:

```bash
# Detect current branch if user didn't specify
git -C [REPO_PATH] branch --show-current

# Push the branch if needed
git -C [REPO_PATH] push -u origin [BRANCH_NAME]

# Create the PR
gh pr create \
  --repo [ORG/REPO] \
  --head [BRANCH_NAME] \
  --base [TARGET_BRANCH] \
  --title "[TICKET-ID] [ticket title]" \
  --body "$(cat <<'EOF'
## JIRA
[TICKET-URL]

## Summary
[bullet list of what was changed, derived from completed tasks]

## Test plan
- [ ] [test step 1]
- [ ] [test step 2]

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

If there are changes in multiple repos, create one PR per repo — ask the user which repos need PRs.

Report the PR URL(s) to the user.

---

## Resuming a Paused Workflow

If the user says "continue tasks" or "resume JIRA tasks" or "/jira TICKET-ID" when a task file already exists:

1. Read the task file `tasks/TICKET-ID.md`
2. Find the first `[ ]` line — that's the next task
3. Resume from Phase 5a for that task

If no task file exists yet, start from Phase 1.

---

## Hard rules

- **Never execute a task without explicit "yes"** from the user
- **One task at a time** — never batch
- **Update the task file AND the backend** after every task completion
- **foodhubglobal is isolated** — if a task involves it, never cross-reference other repos
- **Always check `data/endpoints.json`** before opening any backend file
- **If JIRA update fails**, tell the user and offer to retry — never silently skip
- **Never create a PR without user confirmation** of branch name and target branch

---

## Task file location

All task files live in `tasks/` inside the dev-analyser repo:
```
dev-analyser/
└── tasks/
    ├── FHDB-57844.md
    ├── COTHOR-10101.md
    └── ...
```

This directory is gitignored — task files are local working state.

---

## Quick reference — backend API

| Action | Command |
|--------|---------|
| Get session | `GET /api/jira/session` |
| Update task status | `PATCH /api/jira/tasks/:id` body: `{status: "completed"}` |
| Add custom task | `POST /api/jira/tasks` body: `{title, description, repo, area}` |
| Push analysis to JIRA | `POST /api/jira/push-analysis` |
| Add final comment | `POST /api/jira/add-comment` body: `{notes}` |
| Clear session | `DELETE /api/jira/session` |
