import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

// ─── Status badge ─────────────────────────────────────────────────────────────

const TASK_STATUS_STYLES = {
  pending:     'bg-gray-800 text-gray-400 border-gray-700',
  'in-progress':'bg-sky-900/40 text-sky-300 border-sky-700/50',
  completed:   'bg-emerald-900/40 text-emerald-400 border-emerald-700/50',
  skipped:     'bg-gray-800 text-gray-600 border-gray-700 line-through',
};

const TASK_STATUS_ICONS = {
  pending: '○',
  'in-progress': '◉',
  completed: '✓',
  skipped: '⊘',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${TASK_STATUS_STYLES[status] || TASK_STATUS_STYLES.pending}`}>
      {TASK_STATUS_ICONS[status] || '○'} {status}
    </span>
  );
}

// ─── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ onConfigured }) {
  const [form, setForm]         = useState({ baseUrl: '', email: '', apiToken: '' });
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [msg, setMsg]           = useState(null);
  const [diag, setDiag]         = useState(null);

  useEffect(() => {
    axios.get('/api/jira/config').then(({ data }) => {
      if (data.configured) setForm(f => ({ ...f, baseUrl: data.baseUrl || '', email: data.email || '' }));
    }).catch(() => {});
  }, []);

  async function save() {
    if (!form.baseUrl || !form.email || !form.apiToken) {
      setMsg({ ok: false, text: 'All three fields are required.' }); return;
    }
    setSaving(true); setMsg(null); setDiag(null);
    try {
      await axios.post('/api/jira/config', form);
      setMsg({ ok: true, text: 'Saved.' });
      if (onConfigured) onConfigured();
    } catch { setMsg({ ok: false, text: 'Save failed.' }); }
    setSaving(false);
  }

  async function test() {
    setTesting(true); setMsg(null); setDiag(null);
    try {
      const { data } = await axios.post('/api/jira/config/test');
      setMsg({ ok: true, text: `✓ Connected as ${data.displayName} (${data.email})` });
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error || 'Connection failed' });
    }
    setTesting(false);
  }

  async function runDiagnose() {
    setDiagnosing(true); setDiag(null); setMsg(null);
    const { data } = await axios.get('/api/jira/config/diagnose').catch(e => ({ data: { error: e.message } }));
    setDiag(data);
    setDiagnosing(false);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="text-gray-300 text-sm font-medium">JIRA Credentials</div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-gray-500 text-xs block mb-1">Base URL</label>
          <input className="input w-full" placeholder="https://yourcompany.atlassian.net"
            value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value.trim() }))} />
          <div className="text-gray-600 text-xs mt-0.5">Exactly <code>https://company.atlassian.net</code> — no trailing slash, no /jira suffix.</div>
        </div>

        <div>
          <label className="text-gray-500 text-xs block mb-1">Atlassian Account Email</label>
          <input className="input w-full" placeholder="you@gmail.com or you@company.com"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value.trim() }))} />
          <div className="text-gray-600 text-xs mt-0.5">
            The email shown at{' '}
            <a href="https://id.atlassian.com" target="_blank" rel="noreferrer" className="text-sky-500 hover:underline">id.atlassian.com</a>
            {' '}— often a personal email, not your work address.
          </div>
        </div>

        <div>
          <label className="text-gray-500 text-xs block mb-1">API Token</label>
          <input className="input w-full" type="password"
            placeholder="Create at id.atlassian.com → Security → API tokens"
            value={form.apiToken} onChange={e => setForm(f => ({ ...f, apiToken: e.target.value.trim() }))} />
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={save} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={test} disabled={testing} className="btn-secondary text-xs px-3 py-1.5">
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button onClick={runDiagnose} disabled={diagnosing} className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors">
          {diagnosing ? 'Diagnosing…' : '🔍 Diagnose'}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>

      {/* Diagnose output */}
      {diag && (
        <div className="border-t border-gray-800 pt-3 space-y-2 text-xs">
          {diag.success ? (
            <div className="text-emerald-400">✓ Connected as <strong>{diag.displayName}</strong> ({diag.accountEmail})</div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-500">
                <div>Base URL</div><div className="text-gray-300 font-mono">{diag.baseUrl}</div>
                <div>Email in config</div><div className="text-gray-300 font-mono">{diag.email}</div>
                <div>Token length</div><div className="text-gray-300">{diag.tokenLength} chars</div>
                <div>Token prefix</div><div className="text-gray-300 font-mono">{diag.tokenPrefix}</div>
              </div>

              {(diag.steps || []).map((s, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-t border-gray-800/60">
                  <span className={`shrink-0 font-mono ${s.status >= 200 && s.status < 300 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.status ?? '✗'}
                  </span>
                  <div>
                    <div className="text-gray-400">{s.step.replace(/_/g, ' ')}</div>
                    {s.bodySnippet && <div className="text-gray-600 font-mono mt-0.5">{s.bodySnippet}</div>}
                    {s.error && <div className="text-red-400 mt-0.5">{s.error}</div>}
                  </div>
                </div>
              ))}

              {diag.hint && (
                <div className="p-2 rounded bg-amber-900/20 border border-amber-700/40 text-amber-300">
                  💡 {diag.hint}
                </div>
              )}

              <div className="text-gray-600 pt-1">
                To fix: go to{' '}
                <a href="https://id.atlassian.com" target="_blank" rel="noreferrer" className="text-sky-500 hover:underline">id.atlassian.com</a>
                , copy the exact email shown, create a new API token, paste both above and click Save then Test.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, index, total, onStatusChange, onRemove, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  async function cycleStatus() {
    const cycle = { pending: 'in-progress', 'in-progress': 'completed', completed: 'skipped', skipped: 'pending' };
    onStatusChange(task.id, cycle[task.status] || 'pending');
  }

  async function saveTitle() {
    if (editTitle.trim() && editTitle !== task.title) {
      await axios.patch(`/api/jira/tasks/${task.id}`, { title: editTitle });
    }
    setEditing(false);
  }

  return (
    <div className={`card px-4 py-3 flex items-start gap-3 ${task.status === 'completed' ? 'opacity-60' : ''}`}>
      <button
        onClick={cycleStatus}
        className="mt-0.5 text-lg shrink-0 hover:text-sky-300 transition-colors"
        title="Click to cycle status"
      >
        <span className={task.status === 'completed' ? 'text-emerald-400' : task.status === 'in-progress' ? 'text-sky-400' : task.status === 'skipped' ? 'text-gray-600' : 'text-gray-600'}>
          {TASK_STATUS_ICONS[task.status] || '○'}
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 text-xs font-mono shrink-0">#{index + 1}</span>
          {editing ? (
            <input
              autoFocus
              className="input flex-1 text-sm py-0.5"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
            />
          ) : (
            <span
              className={`text-sm font-medium cursor-pointer hover:text-gray-200 ${task.status === 'skipped' ? 'line-through text-gray-600' : 'text-gray-100'}`}
              onDoubleClick={() => setEditing(true)}
            >
              {task.title}
            </span>
          )}
          <StatusBadge status={task.status} />
        </div>
        {(task.repo || task.area) && (
          <div className="text-gray-600 text-xs mt-0.5 font-mono">
            {[task.repo, task.area].filter(Boolean).join(' · ')}
          </div>
        )}
        {task.description && (
          <div className="text-gray-500 text-xs mt-1">{task.description}</div>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onStatusChange(task.id, 'completed')}
          disabled={task.status === 'completed'}
          className="px-2 py-1 text-xs rounded text-emerald-500 hover:bg-emerald-900/20 disabled:opacity-30 transition-colors"
          title="Mark complete"
        >✓</button>
        <button
          onClick={() => onMoveUp(task.id)}
          disabled={index === 0}
          className="px-1.5 py-1 text-xs rounded text-gray-500 hover:bg-gray-800 disabled:opacity-20 transition-colors"
          title="Move up"
        >▲</button>
        <button
          onClick={() => onMoveDown(task.id)}
          disabled={index === total - 1}
          className="px-1.5 py-1 text-xs rounded text-gray-500 hover:bg-gray-800 disabled:opacity-20 transition-colors"
          title="Move down"
        >▼</button>
        <button
          onClick={() => onRemove(task.id)}
          className="px-2 py-1 text-xs rounded text-gray-600 hover:bg-red-900/20 hover:text-red-400 transition-colors"
          title="Remove"
        >✕</button>
      </div>
    </div>
  );
}

// ─── Ticket finder ────────────────────────────────────────────────────────────

function TicketFinder({ onFetched }) {
  const [ticketId, setTicketId]           = useState('');
  const [fetching, setFetching]           = useState(false);
  const [fetchError, setFetchError]       = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searching, setSearching]         = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [projects, setProjects]           = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showHelper, setShowHelper]       = useState(false);

  async function fetchTicket() {
    if (!ticketId.trim()) return;
    setFetching(true); setFetchError(null);
    try {
      const { data: ticket } = await axios.get(`/api/jira/ticket/${encodeURIComponent(ticketId.trim())}`);
      await axios.post('/api/jira/session', {
        ticketId: ticket.key, ticketTitle: ticket.title, ticketDescription: ticket.description,
        ticketStatus: ticket.status, ticketType: ticket.type, ticketPriority: ticket.priority,
        ticketUrl: ticket.url, assignee: ticket.assignee, reporter: ticket.reporter,
        tasks: [], analysis: '',
      });
      if (onFetched) await onFetched();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Fetch failed';
      setFetchError(msg);
      // If 404, automatically show helper
      if (msg.includes('404') || msg.includes('Not found')) setShowHelper(true);
    }
    setFetching(false);
  }

  async function loadProjects() {
    setLoadingProjects(true);
    const { data } = await axios.get('/api/jira/projects').catch(() => ({ data: { projects: [] } }));
    setProjects(data.projects || []);
    setLoadingProjects(false);
  }

  async function search() {
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchResults(null);
    const { data } = await axios.get(`/api/jira/search?q=${encodeURIComponent(searchQuery)}`).catch(() => ({ data: { results: [] } }));
    setSearchResults(data.results || []);
    setSearching(false);
  }

  async function useTicket(key) {
    setTicketId(key);
    setShowHelper(false);
    setSearchResults(null);
    // Auto-fetch
    setFetching(true); setFetchError(null);
    try {
      const { data: ticket } = await axios.get(`/api/jira/ticket/${encodeURIComponent(key)}`);
      await axios.post('/api/jira/session', {
        ticketId: ticket.key, ticketTitle: ticket.title, ticketDescription: ticket.description,
        ticketStatus: ticket.status, ticketType: ticket.type, ticketPriority: ticket.priority,
        ticketUrl: ticket.url, assignee: ticket.assignee, reporter: ticket.reporter,
        tasks: [], analysis: '',
      });
      if (onFetched) await onFetched();
    } catch (e) {
      setFetchError(e?.response?.data?.error || 'Fetch failed');
    }
    setFetching(false);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="text-gray-300 text-sm font-medium">Fetch Ticket</div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="e.g. SITE-123, FHG-456"
          value={ticketId}
          onChange={e => setTicketId(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && fetchTicket()}
        />
        <button onClick={fetchTicket} disabled={fetching || !ticketId.trim()} className="btn-primary text-xs px-4">
          {fetching ? 'Fetching…' : 'Fetch'}
        </button>
        <button
          onClick={() => { setShowHelper(h => !h); if (!projects) loadProjects(); }}
          className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${showHelper ? 'border-sky-500/50 text-sky-300 bg-sky-900/20' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
          title="Browse projects / search tickets"
        >
          ⌕ Find
        </button>
      </div>

      {fetchError && (
        <div className="space-y-1">
          <div className="text-red-400 text-xs">{fetchError}</div>
          {fetchError.includes('404') || fetchError.includes('Not found') ? (
            <div className="text-gray-500 text-xs">
              Ticket not found. Check the project key is correct, or use{' '}
              <button className="text-sky-400 underline" onClick={() => { setShowHelper(true); loadProjects(); }}>
                Browse Projects
              </button>{' '}to find the right key.
            </div>
          ) : fetchError.includes('401') ? (
            <div className="text-amber-400 text-xs">
              Auth failed — click ⚙ Configure JIRA above to update credentials.
            </div>
          ) : null}
        </div>
      )}

      {/* Helper panel: projects + search */}
      {showHelper && (
        <div className="border-t border-gray-800 pt-3 space-y-3">
          {/* Text search */}
          <div>
            <div className="text-gray-400 text-xs font-medium mb-1.5">Search tickets</div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-xs"
                placeholder="Search by title, keyword..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
              <button onClick={search} disabled={searching || !searchQuery.trim()} className="btn-secondary text-xs px-3">
                {searching ? '…' : 'Search'}
              </button>
            </div>
            {searchResults && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="text-gray-600 text-xs">No results</div>
                ) : searchResults.map(r => (
                  <button
                    key={r.key}
                    onClick={() => useTicket(r.key)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-800 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 font-mono text-xs shrink-0">{r.key}</span>
                      <span className="text-gray-300 text-xs truncate group-hover:text-white">{r.title}</span>
                      <span className="text-gray-600 text-xs shrink-0 ml-auto">{r.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-gray-400 text-xs font-medium">Your projects</div>
              {loadingProjects && <span className="text-gray-600 text-xs">Loading…</span>}
            </div>
            {projects && (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {projects.length === 0 ? (
                  <span className="text-gray-600 text-xs">No projects found</span>
                ) : projects.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setTicketId(p.key + '-')}
                    className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs transition-colors group"
                    title={p.name}
                  >
                    <span className="text-sky-400 font-mono">{p.key}</span>
                    <span className="text-gray-500 ml-1 group-hover:text-gray-300">{p.name.slice(0, 20)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

function AddTaskForm({ onAdded }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [repo, setRepo] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    await axios.post('/api/jira/tasks', { title, description: desc, repo });
    setTitle(''); setDesc(''); setRepo(''); setShow(false);
    setSaving(false);
    if (onAdded) onAdded();
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="btn-secondary text-xs px-3 py-1.5 w-full">
        + Add Task
      </button>
    );
  }

  return (
    <div className="card p-3 space-y-2">
      <input
        autoFocus
        className="input w-full text-sm"
        placeholder="Task title *"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && add()}
      />
      <input
        className="input w-full text-xs"
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />
      <input
        className="input w-full text-xs"
        placeholder="Repo (e.g. foodhubglobal, t2s-api)"
        value={repo}
        onChange={e => setRepo(e.target.value)}
      />
      <div className="flex gap-2">
        <button onClick={add} disabled={saving || !title.trim()} className="btn-primary text-xs px-3 py-1.5">
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button onClick={() => setShow(false)} className="btn-secondary text-xs px-3 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Implementation notes / final comment ─────────────────────────────────────

function FinalCommentPanel({ session, onDone }) {
  const [notes, setNotes] = useState('');
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState(null);

  async function post() {
    setPosting(true); setMsg(null);
    try {
      await axios.post('/api/jira/add-comment', { notes });
      setMsg({ ok: true, text: 'Comment added to JIRA ✓' });
      if (onDone) onDone();
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error || 'Failed to add comment' });
    }
    setPosting(false);
  }

  const completed = (session?.tasks || []).filter(t => t.status === 'completed').length;
  const total = (session?.tasks || []).length;

  return (
    <div className="card p-4 space-y-3 border-l-2 border-emerald-500/40">
      <div className="text-emerald-400 text-sm font-medium">
        Implementation Complete — {completed}/{total} tasks done
      </div>
      <textarea
        className="input w-full text-xs"
        rows={4}
        placeholder="Brief implementation notes (what was changed, any caveats, follow-up items)..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="flex gap-2 items-center">
        <button onClick={post} disabled={posting} className="btn-primary text-xs px-3 py-1.5">
          {posting ? 'Posting…' : 'Add Comment to JIRA'}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
      {session?.commentAdded && (
        <div className="text-emerald-400 text-xs">✓ Implementation comment already posted to JIRA</div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JiraPage() {
  const [jiraConfig, setJiraConfig]   = useState(null);
  const [showConfig, setShowConfig]   = useState(false);
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pushingAnalysis, setPushingAnalysis] = useState(false);
  const [pushMsg, setPushMsg]         = useState(null);

  const loadSession = useCallback(async () => {
    const res = await axios.get('/api/jira/session').catch(() => ({ data: { active: false } }));
    setSession(res.data.active ? res.data : null);
  }, []);

  const loadConfig = useCallback(async () => {
    const res = await axios.get('/api/jira/config').catch(() => ({ data: { configured: false } }));
    setJiraConfig(res.data);
  }, []);

  useEffect(() => {
    Promise.all([loadConfig(), loadSession()]).finally(() => setLoading(false));
  }, []);

  async function fetchTicket() {
    if (!ticketId.trim()) return;
    setFetchingTicket(true); setTicketError(null);
    try {
      const { data: ticket } = await axios.get(`/api/jira/ticket/${encodeURIComponent(ticketId.trim())}`);
      // Create a new session with this ticket (tasks start empty — user runs /jira in chat)
      await axios.post('/api/jira/session', {
        ticketId: ticket.key,
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        ticketStatus: ticket.status,
        ticketType: ticket.type,
        ticketPriority: ticket.priority,
        ticketUrl: ticket.url,
        assignee: ticket.assignee,
        reporter: ticket.reporter,
        tasks: [],
        analysis: '',
      });
      await loadSession();
    } catch (e) {
      setTicketError(e?.response?.data?.error || `Could not fetch ${ticketId}`);
    }
    setFetchingTicket(false);
  }

  async function pushAnalysis() {
    setPushingAnalysis(true); setPushMsg(null);
    try {
      await axios.post('/api/jira/push-analysis');
      setPushMsg({ ok: true, text: 'Analysis posted to JIRA ✓' });
      await loadSession();
    } catch (e) {
      setPushMsg({ ok: false, text: e?.response?.data?.error || 'Push failed' });
    }
    setPushingAnalysis(false);
  }

  async function updateTaskStatus(taskId, status) {
    await axios.patch(`/api/jira/tasks/${taskId}`, { status });
    await loadSession();
  }

  async function removeTask(taskId) {
    await axios.delete(`/api/jira/tasks/${taskId}`);
    await loadSession();
  }

  async function moveTask(taskId, direction) {
    if (!session) return;
    const tasks = [...session.tasks].sort((a, b) => a.order - b.order);
    const idx = tasks.findIndex(t => t.id === taskId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;
    [tasks[idx].order, tasks[swapIdx].order] = [tasks[swapIdx].order, tasks[idx].order];
    await axios.put('/api/jira/tasks/reorder', { orderedIds: tasks.sort((a, b) => a.order - b.order).map(t => t.id) });
    await loadSession();
  }

  async function clearSession() {
    if (!confirm('Clear current JIRA session?')) return;
    await axios.delete('/api/jira/session');
    setSession(null);
  }

  if (loading) return <div className="text-gray-500 text-sm">Loading…</div>;

  const tasks = session ? [...(session.tasks || [])].sort((a, b) => a.order - b.order) : [];
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'completed' || t.status === 'skipped');

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">JIRA Integration</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Fetch a ticket · analyse requirements · track tasks · update JIRA
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(s => !s)}
            className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
              jiraConfig?.configured
                ? 'text-emerald-400 border-emerald-700/50 hover:bg-emerald-900/20'
                : 'text-amber-400 border-amber-700/50 hover:bg-amber-900/20'
            }`}
          >
            ⚙ {jiraConfig?.configured ? `Connected` : 'Configure JIRA'}
          </button>
          {session && (
            <button onClick={clearSession} className="text-xs px-2.5 py-1.5 rounded border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-700/50 transition-colors">
              ✕ Clear Session
            </button>
          )}
        </div>
      </div>

      {/* Config panel */}
      {(!jiraConfig?.configured || showConfig) && (
        <ConfigPanel onConfigured={() => { loadConfig(); setShowConfig(false); }} />
      )}

      {/* JIRA tip */}
      {!session && jiraConfig?.configured && (
        <div className="card p-3 border-l-2 border-sky-500/40 text-xs text-gray-400 space-y-1">
          <div className="text-sky-300 font-medium">Workflow</div>
          <div>1. Fetch a ticket below to start a session</div>
          <div>2. Run <code className="bg-gray-800 px-1 rounded text-sky-300">/jira TICKET-ID</code> in the Claude Code chat to analyse and generate tasks</div>
          <div>3. Track and manage tasks here · push updates to JIRA when ready</div>
        </div>
      )}

      {/* Ticket lookup */}
      {jiraConfig?.configured && (
        <TicketFinder onFetched={async () => { await loadSession(); }} />
      )}

      {/* Active session */}
      {session && (
        <>
          {/* Ticket details */}
          <div className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={session.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 font-mono text-sm hover:underline shrink-0"
                  >
                    {session.ticketId}
                  </a>
                  <span className="text-gray-100 font-medium text-sm">{session.ticketTitle}</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  {session.ticketStatus && <span className="text-emerald-400">{session.ticketStatus}</span>}
                  {session.ticketType && <span>{session.ticketType}</span>}
                  {session.ticketPriority && <span>{session.ticketPriority}</span>}
                  {session.assignee && <span>→ {session.assignee}</span>}
                </div>
              </div>
              {session.jiraUpdated && (
                <span className="text-emerald-400 text-xs shrink-0">✓ JIRA updated</span>
              )}
            </div>

            {session.ticketDescription && (
              <div className="text-gray-400 text-xs leading-relaxed border-t border-gray-800 pt-3 whitespace-pre-wrap line-clamp-4">
                {session.ticketDescription}
              </div>
            )}
          </div>

          {/* Analysis */}
          {session.analysis && (
            <div className="card p-4 space-y-2">
              <div className="text-gray-300 text-sm font-medium">Claude Analysis</div>
              <div className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap">{session.analysis}</div>
            </div>
          )}

          {/* Task plan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-gray-300 text-sm font-medium">
                Task Plan
                {tasks.length > 0 && (
                  <span className="text-gray-500 text-xs font-normal ml-2">
                    {completedCount}/{tasks.length} done
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {tasks.length > 0 && (
                  <>
                    <div className="text-xs text-gray-600">
                      Progress: {Math.round((completedCount / tasks.length) * 100)}%
                    </div>
                    <button
                      onClick={pushAnalysis}
                      disabled={pushingAnalysis}
                      className="text-xs px-2.5 py-1.5 rounded border border-violet-700/50 text-violet-400 hover:bg-violet-900/20 transition-colors"
                    >
                      {pushingAnalysis ? 'Pushing…' : '⇡ Push to JIRA'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {pushMsg && (
              <div className={`text-xs ${pushMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{pushMsg.text}</div>
            )}

            {tasks.length === 0 ? (
              <div className="card p-4 text-xs text-gray-500 text-center">
                No tasks yet — run{' '}
                <code className="bg-gray-800 px-1 rounded text-sky-300">/jira {session.ticketId}</code>
                {' '}in Claude Code chat to analyse this ticket and generate tasks,
                or add tasks manually below.
              </div>
            ) : (
              <div className="space-y-1.5">
                {tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    total={tasks.length}
                    onStatusChange={updateTaskStatus}
                    onRemove={removeTask}
                    onMoveUp={() => moveTask(task.id, 'up')}
                    onMoveDown={() => moveTask(task.id, 'down')}
                  />
                ))}
              </div>
            )}

            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(completedCount / tasks.length) * 100}%` }}
                />
              </div>
            )}

            <AddTaskForm onAdded={loadSession} />
          </div>

          {/* Final comment */}
          {allDone && (
            <FinalCommentPanel session={session} onDone={loadSession} />
          )}
        </>
      )}
    </div>
  );
}
