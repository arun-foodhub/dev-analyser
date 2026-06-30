import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ScanButton from '../components/ScanButton.jsx';
import MethodBadge from '../components/MethodBadge.jsx';

const TYPE_COLORS = {
  pages:        'text-sky-400',
  'api-routes': 'text-emerald-400',
  redux:        'text-violet-400',
  services:     'text-amber-400',
  hooks:        'text-pink-400',
  components:   'text-blue-400',
  lib:          'text-teal-400',
};

const TYPE_ICONS = {
  pages:        '⬡',
  'api-routes': '⇄',
  redux:        '◈',
  services:     '⚙',
  hooks:        '⌁',
  components:   '⊞',
  lib:          '◧',
};

function TypeBadge({ type }) {
  const color = TYPE_COLORS[type] || 'text-gray-500';
  const icon = TYPE_ICONS[type] || '·';
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 ${color}`}>
      {icon} {type}
    </span>
  );
}

function ModuleCard({ mod }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <div
        className="px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-100 font-medium text-sm">{mod.name}</span>
            <TypeBadge type={mod.type} />
          </div>
          <div className="text-gray-500 text-xs mt-1">
            {mod.count} {mod.count === 1 ? 'item' : 'items'}
          </div>
        </div>
        <div className="text-gray-600 ml-3">{open ? '▲' : '▼'}</div>
      </div>

      {open && (
        <div className="border-t border-gray-800 px-4 py-3 text-xs space-y-1">
          {mod.type === 'pages' && mod.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="font-mono text-sky-300 shrink-0">{item.route}</span>
              <span className="text-gray-500 font-mono truncate">{item.file}</span>
            </div>
          ))}

          {mod.type === 'api-routes' && mod.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <div className="flex gap-1 shrink-0">
                {item.methods.map(m => <MethodBadge key={m} method={m} />)}
              </div>
              <span className="font-mono text-emerald-300">{item.route}</span>
              <span className="text-gray-600 font-mono truncate ml-auto">{item.file}</span>
            </div>
          ))}

          {mod.type === 'redux' && mod.items.map((item, i) => (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2">
                <span className="text-violet-300 font-mono font-medium">{item.name}</span>
                <span className="text-gray-600 font-mono truncate">{item.file}</span>
              </div>
              {item.asyncThunks?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 ml-2">
                  {item.asyncThunks.map((t, j) => (
                    <span key={j} className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono text-xs">
                      {t.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {mod.type === 'services' && mod.items.map((item, i) => (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2">
                <span className="text-amber-300 font-mono">{item.name}</span>
                <span className="text-gray-600 font-mono truncate">{item.file}</span>
              </div>
              {item.exports?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 ml-2">
                  {item.exports.map((e, j) => (
                    <span key={j} className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono text-xs">
                      {e}()
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {(mod.type === 'hooks' || mod.type === 'components' || mod.type === 'lib') && mod.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className={`font-mono ${mod.type === 'hooks' ? 'text-pink-300' : mod.type === 'components' ? 'text-blue-300' : 'text-teal-300'}`}>
                {item.name}
              </span>
              <span className="text-gray-600 font-mono truncate">{item.file}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FoodHubModulesPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const res = await axios.get('/api/foodhubglobal-modules').catch(() => ({ data: null }));
    setData(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const modules = useMemo(() => {
    const all = data?.modules?.foodhubglobal || [];
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.type.includes(q) ||
      m.items.some(item =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.file || '').toLowerCase().includes(q) ||
        (item.route || '').toLowerCase().includes(q)
      )
    );
  }, [data, search]);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  const stats = data?.stats || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">FoodHub Global — App Structure</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            SiteMaster Next.js app — pages, API routes, Redux, services, components, hooks
          </p>
        </div>
        <ScanButton type="foodhubglobal-modules" label="Scan" onDone={load} />
      </div>

      {data?.notScanned && (
        <div className="card p-3 border-l-2 border-amber-500/50 text-amber-300 text-xs">
          No data yet — click Scan to analyse the foodhubglobal repo.
        </div>
      )}

      {!data?.notScanned && (
        <>
          <div className="grid grid-cols-7 gap-2">
            {[
              { label: 'Pages',       value: stats.pages },
              { label: 'API Routes',  value: stats.apiRoutes },
              { label: 'Components',  value: stats.components },
              { label: 'Redux Slices',value: stats.reduxSlices },
              { label: 'Services',    value: stats.services },
              { label: 'Hooks',       value: stats.hooks },
              { label: 'Lib Files',   value: stats.libFiles },
            ].map(s => (
              <div key={s.label} className="card px-2 py-2 text-center">
                <div className="text-xl font-bold text-sky-300">{s.value ?? 0}</div>
                <div className="text-gray-500 text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          <input
            className="input w-72"
            placeholder="Search pages, routes, components..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div className="space-y-2">
            {modules.length === 0 ? (
              <div className="text-gray-600 text-xs py-8 text-center">No modules found</div>
            ) : (
              modules.map(mod => <ModuleCard key={mod.id} mod={mod} />)
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
