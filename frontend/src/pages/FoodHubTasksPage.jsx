import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ScanButton from '../components/ScanButton.jsx';

const STATUS_STYLES = {
  completed:   'bg-emerald-900/40 text-emerald-400 border-emerald-700/50',
  'in-progress':'bg-sky-900/40 text-sky-400 border-sky-700/50',
  failed:      'bg-red-900/40 text-red-400 border-red-700/50',
  neutral:     'bg-gray-800 text-gray-500 border-gray-700',
};

function TaskCard({ task }) {
  const [open, setOpen] = useState(false);
  const statusStyle = STATUS_STYLES[task.statusClass] || STATUS_STYLES.neutral;

  return (
    <div className="card">
      <div
        className="px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 text-xs font-mono shrink-0">#{String(task.num).padStart(2, '0')}</span>
            <span className="text-gray-100 font-medium text-sm">{task.title}</span>
            {task.status && (
              <span className={`text-xs px-1.5 py-0.5 rounded border font-mono shrink-0 ${statusStyle}`}>
                {task.status}
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-1 text-xs text-gray-600">
            {task.date && <span>{task.date}</span>}
            {task.taskType && <span className="text-gray-500">{task.taskType}</span>}
          </div>
          {task.preview && (
            <p className="text-gray-500 text-xs mt-1.5 line-clamp-2">{task.preview}</p>
          )}
        </div>
        <div className="text-gray-600 ml-3 shrink-0">{open ? '▲' : '▼'}</div>
      </div>

      {open && (
        <div className="border-t border-gray-800 px-4 py-3 text-xs space-y-2">
          <div className="text-gray-400 font-mono">
            {task.filename}
          </div>
          {task.preview && (
            <p className="text-gray-400 leading-relaxed">{task.preview}</p>
          )}
          <div className="flex gap-3 text-gray-600">
            {task.date && <span>Date: {task.date}</span>}
            {task.taskType && <span>Type: {task.taskType}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FoodHubTasksPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    const res = await axios.get('/api/tasksummaries').catch(() => ({ data: null }));
    setData(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const tasks = useMemo(() => {
    const all = data?.tasks || [];
    const q = search.toLowerCase();
    return all.filter(t => {
      const matchesSearch = !q ||
        t.title.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q) ||
        t.taskType.toLowerCase().includes(q) ||
        String(t.num).includes(q);
      const matchesStatus = statusFilter === 'all' || t.statusClass === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const all = data?.tasks || [];
    return {
      completed: all.filter(t => t.statusClass === 'completed').length,
      'in-progress': all.filter(t => t.statusClass === 'in-progress').length,
      neutral: all.filter(t => t.statusClass === 'neutral').length,
    };
  }, [data]);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">FoodHub Global — Task History</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Development task summaries from the tasksummary/ directory ({data?.total ?? 0} tasks)
          </p>
        </div>
        <ScanButton type="tasksummaries" label="Refresh" onDone={load} />
      </div>

      {data?.notScanned && (
        <div className="card p-3 border-l-2 border-amber-500/50 text-amber-300 text-xs">
          No data yet — click Refresh to load task summaries.
        </div>
      )}

      {!data?.notScanned && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="card px-3 py-2 text-center">
              <div className="text-xl font-bold text-sky-300">{data?.total ?? 0}</div>
              <div className="text-gray-500 text-xs">Total Tasks</div>
            </div>
            <div className="card px-3 py-2 text-center">
              <div className="text-xl font-bold text-emerald-400">{statusCounts.completed}</div>
              <div className="text-gray-500 text-xs">Completed</div>
            </div>
            <div className="card px-3 py-2 text-center">
              <div className="text-xl font-bold text-sky-400">{statusCounts['in-progress']}</div>
              <div className="text-gray-500 text-xs">In Progress</div>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <input
              className="input w-72"
              placeholder="Search tasks by title, type, content..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="flex gap-1">
              {['all', 'completed', 'in-progress', 'neutral'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
                    statusFilter === s
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  {s === 'all' ? `All (${data?.total ?? 0})` : s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-gray-600 text-xs py-8 text-center">No tasks found</div>
            ) : (
              tasks.map(task => <TaskCard key={task.slug} task={task} />)
            )}
          </div>

          {data?.lastScanned && (
            <p className="text-gray-600 text-xs">
              Last scanned: {new Date(data.lastScanned).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
