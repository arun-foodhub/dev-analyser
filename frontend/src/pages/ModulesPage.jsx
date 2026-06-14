import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ScanButton from '../components/ScanButton.jsx';
import MethodBadge from '../components/MethodBadge.jsx';

function ModuleCard({ mod }) {
  const [open, setOpen] = useState(false);
  const total = mod.screens.length + mod.components.length + mod.services.length;

  return (
    <div className="card">
      <div
        className="px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-gray-100 font-medium text-sm">{mod.name}</div>
          <div className="text-gray-500 text-xs mt-0.5 flex gap-3">
            {mod.screens.length > 0 && <span>{mod.screens.length} screens</span>}
            {mod.components.length > 0 && <span>{mod.components.length} components</span>}
            {mod.services.length > 0 && <span>{mod.services.length} services</span>}
            {mod.apiEndpoints.length > 0 && <span className="text-sky-500">{mod.apiEndpoints.length} API calls</span>}
          </div>
          <div className="text-gray-600 text-xs mt-1 font-mono">{mod.dirs.join(', ')}</div>
        </div>
        <div className="text-gray-600 ml-3">{open ? '▲' : '▼'}</div>
      </div>

      {open && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-4 text-xs">

          {mod.screens.length > 0 && (
            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-2">Screens</div>
              <div className="grid grid-cols-2 gap-1">
                {mod.screens.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-sky-400">▸</span>
                    <span className="text-gray-300">{s.name}</span>
                    <span className="text-gray-600 font-mono truncate text-xs">{s.file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mod.components.length > 0 && (
            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-2">Components</div>
              <div className="flex flex-wrap gap-1.5">
                {mod.components.map((c, i) => (
                  <span key={i} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs">{c.name}</span>
                ))}
              </div>
            </div>
          )}

          {mod.services.length > 0 && (
            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-2">Services / API Layer</div>
              <div className="space-y-1">
                {mod.services.map((s, i) => (
                  <div key={i} className="font-mono text-amber-300">{s.file}</div>
                ))}
              </div>
            </div>
          )}

          {mod.apiEndpoints.length > 0 && (
            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-2">API Calls Used</div>
              <div className="space-y-1">
                {mod.apiEndpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <MethodBadge method={ep.method} />
                    <span className="font-mono text-gray-300">{ep.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModulesPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [repoTab, setRepoTab] = useState(null);

  async function load() {
    setLoading(true);
    const res = await axios.get('/api/modules').catch(() => ({ data: null }));
    setData(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const repoNames = useMemo(() => data?.modules ? Object.keys(data.modules) : [], [data]);

  useEffect(() => {
    if (repoNames.length && !repoTab) setRepoTab(repoNames[0]);
  }, [repoNames]);

  const currentModules = useMemo(() => {
    if (!repoTab || !data?.modules?.[repoTab]) return [];
    const q = search.toLowerCase();
    return data.modules[repoTab].filter(m =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.dirs.some(d => d.toLowerCase().includes(q)) ||
      m.apiEndpoints.some(ep => ep.path.toLowerCase().includes(q))
    );
  }, [data, repoTab, search]);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">App Modules</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Frontend codebase broken down by feature module
          </p>
        </div>
        <ScanButton type="modules" label="Scan Modules" onDone={load} />
      </div>

      {data?.notScanned && (
        <div className="card p-3 border-l-2 border-amber-500/50 text-amber-300 text-xs">
          No data yet — run a scan first.
        </div>
      )}

      {!data?.notScanned && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Module Groups', value: data?.stats?.totalModules },
              { label: 'Screens',       value: data?.stats?.totalScreens },
              { label: 'Components',    value: data?.stats?.totalComponents },
              { label: 'Services',      value: data?.stats?.totalServices },
            ].map(s => (
              <div key={s.label} className="card px-3 py-2 text-center">
                <div className="text-xl font-bold text-sky-300">{s.value ?? 0}</div>
                <div className="text-gray-500 text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Repo tabs */}
          {repoNames.length > 1 && (
            <div className="flex gap-1 border-b border-gray-800 pb-2">
              {repoNames.map(name => (
                <button
                  key={name}
                  onClick={() => setRepoTab(name)}
                  className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                    repoTab === name ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            className="input w-72"
            placeholder="Search module, path, API endpoint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Module cards */}
          <div className="space-y-2">
            {currentModules.length === 0 ? (
              <div className="text-gray-600 text-xs py-8 text-center">No modules found</div>
            ) : (
              currentModules.map(mod => <ModuleCard key={mod.id} mod={mod} />)
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
