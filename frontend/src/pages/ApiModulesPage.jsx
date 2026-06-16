import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ScanButton from '../components/ScanButton.jsx';
import MethodBadge from '../components/MethodBadge.jsx';

const CATEGORY_COLORS = {
  auth:          'text-yellow-400',
  order:         'text-sky-400',
  cart:          'text-sky-300',
  menu:          'text-green-400',
  payment:       'text-emerald-400',
  store:         'text-orange-400',
  customer:      'text-blue-400',
  driver:        'text-purple-400',
  location:      'text-teal-400',
  loyalty:       'text-pink-400',
  offers:        'text-red-400',
  notifications: 'text-amber-400',
  dinein:        'text-indigo-400',
  staff:         'text-slate-400',
  devices:       'text-cyan-400',
  integrations:  'text-violet-400',
  review:        'text-rose-400',
  uploads:       'text-lime-400',
  tasks:         'text-zinc-400',
  cms:           'text-fuchsia-400',
  other:         'text-gray-500',
};

function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || 'text-gray-500';
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 ${color}`}>
      {category}
    </span>
  );
}

function ApiModuleCard({ mod }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('endpoints');

  return (
    <div className="card">
      <div
        className="px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-100 font-medium text-sm">{mod.name}</span>
            <CategoryBadge category={mod.category} />
          </div>
          <div className="text-gray-500 text-xs mt-1 flex flex-wrap gap-3">
            {mod.controllers.length > 0 && (
              <span>{mod.controllers.length} controller{mod.controllers.length !== 1 ? 's' : ''}</span>
            )}
            {mod.repositories.length > 0 && (
              <span>{mod.repositories.length} repositor{mod.repositories.length !== 1 ? 'ies' : 'y'}</span>
            )}
            {mod.services.length > 0 && (
              <span>{mod.services.length} service{mod.services.length !== 1 ? 's' : ''}</span>
            )}
            {mod.endpointCount > 0 && (
              <span className="text-sky-500">{mod.endpointCount} endpoint{mod.endpointCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="text-gray-600 ml-3">{open ? '▲' : '▼'}</div>
      </div>

      {open && (
        <div className="border-t border-gray-800 text-xs">
          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-800">
            {['endpoints', 'controllers', 'repositories', 'services'].map(t => (
              (t === 'endpoints' ? mod.endpointCount > 0 :
               t === 'controllers' ? mod.controllers.length > 0 :
               t === 'repositories' ? mod.repositories.length > 0 :
               mod.services.length > 0) && (
                <button
                  key={t}
                  onClick={e => { e.stopPropagation(); setTab(t); }}
                  className={`px-3 py-2 transition-colors capitalize ${
                    tab === t
                      ? 'text-sky-300 border-b border-sky-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t}
                  {t === 'endpoints' && mod.endpointCount > 0 && (
                    <span className="ml-1 text-gray-600">({mod.endpointCount})</span>
                  )}
                </button>
              )
            ))}
          </div>

          <div className="px-4 py-3 space-y-1">
            {/* Endpoints tab */}
            {tab === 'endpoints' && mod.endpoints.map((ep, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <MethodBadge method={ep.method} />
                <span className="font-mono text-gray-300 truncate">{ep.path}</span>
                {ep.matchedFrontendCalls?.length > 0 && (
                  <span className="text-emerald-500 text-xs ml-auto shrink-0">
                    {ep.matchedFrontendCalls.length} caller{ep.matchedFrontendCalls.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ))}

            {/* Controllers tab */}
            {tab === 'controllers' && mod.controllers.map((c, i) => (
              <div key={i} className="py-1">
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 font-mono">{c.name}</span>
                  <span className="text-gray-600">{c.methodCount} method{c.methodCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-gray-600 font-mono mt-0.5">{c.file}</div>
                {c.methods.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.methods.map((m, j) => (
                      <span key={j} className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono text-xs">
                        {m}()
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Repositories tab */}
            {tab === 'repositories' && mod.repositories.map((r, i) => (
              <div key={i} className="py-0.5">
                <span className="text-violet-300 font-mono">{r.name}</span>
                <span className="text-gray-600 font-mono ml-2">{r.file}</span>
              </div>
            ))}

            {/* Services tab */}
            {tab === 'services' && mod.services.map((s, i) => (
              <div key={i} className="py-0.5">
                <span className="text-teal-300 font-mono">{s.name}</span>
                <span className="text-gray-600 font-mono ml-2">{s.file}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiModulesPage({ lockedRepo = null, repoLabel = null }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [repoTab, setRepoTab] = useState(lockedRepo || null);

  async function load() {
    setLoading(true);
    const res = await axios.get('/api/api-modules').catch(() => ({ data: null }));
    setData(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const repoNames = useMemo(() => data?.modules ? Object.keys(data.modules) : [], [data]);

  useEffect(() => {
    if (!lockedRepo && repoNames.length && !repoTab) setRepoTab(repoNames[0]);
  }, [repoNames]);

  const activeRepo = lockedRepo || repoTab;

  const currentModules = useMemo(() => {
    if (!activeRepo || !data?.modules?.[activeRepo]) return [];
    const q = search.toLowerCase();
    return data.modules[activeRepo].filter(m =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.controllers.some(c => c.name.toLowerCase().includes(q)) ||
      m.repositories.some(r => r.name.toLowerCase().includes(q)) ||
      m.endpoints.some(e => e.path.toLowerCase().includes(q))
    );
  }, [data, activeRepo, search]);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">
            {repoLabel ? `${repoLabel} — API Modules` : 'API Modules'}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Backend codebase broken down by feature module — controllers, repositories, services
          </p>
        </div>
        <ScanButton type="api-modules" label="Scan API Modules" onDone={load} />
      </div>

      {data?.notScanned && (
        <div className="card p-3 border-l-2 border-amber-500/50 text-amber-300 text-xs">
          No data yet — run a scan first (npm run scan:api-modules).
        </div>
      )}

      {!data?.notScanned && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Modules',      value: data?.stats?.totalModules },
              { label: 'Controllers',  value: data?.stats?.totalControllers },
              { label: 'Repositories', value: data?.stats?.totalRepositories },
              { label: 'Services',     value: data?.stats?.totalServices },
              { label: 'Endpoints',    value: data?.stats?.totalEndpoints },
            ].map(s => (
              <div key={s.label} className="card px-3 py-2 text-center">
                <div className="text-xl font-bold text-sky-300">{s.value ?? 0}</div>
                <div className="text-gray-500 text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Repo tabs — only shown when not locked to a single repo */}
          {!lockedRepo && repoNames.length > 1 && (
            <div className="flex gap-1 border-b border-gray-800 pb-2">
              {repoNames.map(name => (
                <button
                  key={name}
                  onClick={() => setRepoTab(name)}
                  className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                    repoTab === name
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-gray-500 hover:text-gray-300'
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
            placeholder="Search module, controller, path..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Module cards */}
          <div className="space-y-2">
            {currentModules.length === 0 ? (
              <div className="text-gray-600 text-xs py-8 text-center">No modules found</div>
            ) : (
              currentModules.map(mod => <ApiModuleCard key={mod.id} mod={mod} />)
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
