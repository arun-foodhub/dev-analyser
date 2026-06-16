import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ScanButton from '../components/ScanButton.jsx';

const COLORS = {
  sky:    { border: 'border-sky-500/30',    text: 'text-sky-300',    dim: 'text-sky-500/60' },
  violet: { border: 'border-violet-500/30', text: 'text-violet-300', dim: 'text-violet-500/60' },
  emerald:{ border: 'border-emerald-500/30',text: 'text-emerald-300',dim: 'text-emerald-500/60' },
  amber:  { border: 'border-amber-500/30',  text: 'text-amber-300',  dim: 'text-amber-500/60' },
};

function StatCard({ label, value, sub, color = 'sky' }) {
  const c = COLORS[color];
  return (
    <div className={`card p-4 border-l-2 ${c.border}`}>
      <div className={`text-2xl font-bold ${c.text}`}>{value ?? '—'}</div>
      <div className="text-gray-400 text-xs mt-1">{label}</div>
      {sub && <div className="text-gray-600 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionDivider({ label, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-semibold uppercase tracking-widest ${color}`}>{label}</span>
      <div className="flex-1 border-t border-gray-800" />
    </div>
  );
}

function QuickLink({ to, label, icon, color }) {
  return (
    <Link
      to={to}
      className={`card px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:bg-gray-800 transition-colors ${color}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span className="ml-auto text-gray-600">→</span>
    </Link>
  );
}

export default function DashboardPage() {
  const [endpoints,  setEndpoints]  = useState(null);
  const [modules,    setModules]    = useState(null);
  const [apiModules, setApiModules] = useState(null);
  const [repos,      setRepos]      = useState([]);
  const [loading,    setLoading]    = useState(true);

  async function load() {
    setLoading(true);
    const [ep, mod, api, rp] = await Promise.all([
      axios.get('/api/endpoints').then(r => r.data).catch(() => null),
      axios.get('/api/modules').then(r => r.data).catch(() => null),
      axios.get('/api/api-modules').then(r => r.data).catch(() => null),
      axios.get('/api/repos').then(r => r.data).catch(() => []),
    ]);
    setEndpoints(ep);
    setModules(mod);
    setApiModules(api);
    setRepos(rp);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const notScanned   = !endpoints || endpoints.notScanned;
  const custModules  = modules?.modules?.['customer_app_2.0'] || [];
  const screenCount  = custModules.reduce((s, m) => s + (m.screens?.length  || 0), 0);
  const compCount    = custModules.reduce((s, m) => s + (m.components?.length || 0), 0);

  return (
    <div className="space-y-7">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Dev Analyser</h1>
          <p className="text-gray-500 text-xs mt-0.5">FoodHub platform — cross-repo analysis dashboard</p>
        </div>
        <ScanButton type="all" label="Full Scan" onDone={load} />
      </div>

      {/* ── No data banner ── */}
      {!loading && notScanned && (
        <div className="card p-4 border-l-2 border-amber-500/50 bg-amber-500/5">
          <div className="text-amber-300 font-medium text-xs">No scan data yet</div>
          <div className="text-gray-400 text-xs mt-1">
            Click <strong className="text-white">Full Scan</strong> above, or run{' '}
            <code className="text-sky-400">npm run scan</code> in the terminal.
          </div>
        </div>
      )}

      {/* ── Customer App ── */}
      <div className="space-y-3">
        <SectionDivider label="Customer App" color="text-sky-400" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Module Groups"  value={custModules.length || null} color="sky" />
          <StatCard label="Screens"        value={screenCount || null}        color="sky" />
          <StatCard label="Components"     value={compCount || null}          color="sky" />
          <StatCard
            label="APIs Called"
            value={endpoints?.stats?.matchedRoutes}
            sub="backend endpoints used"
            color="emerald"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <QuickLink to="/customer-app/modules"   label="App Modules"  icon="⊞" color="text-sky-300" />
          <QuickLink to="/customer-app/endpoints" label="Endpoints"    icon="⇄" color="text-sky-300" />
        </div>
      </div>

      {/* ── t2s-api ── */}
      <div className="space-y-3">
        <SectionDivider label="t2s-api" color="text-violet-400" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="API Modules"   value={apiModules?.stats?.totalModules}      color="violet" />
          <StatCard label="Controllers"   value={apiModules?.stats?.totalControllers}  color="violet" />
          <StatCard label="Repositories"  value={apiModules?.stats?.totalRepositories} color="violet" />
          <StatCard
            label="Endpoints"
            value={apiModules?.stats?.totalEndpoints}
            sub="current version only"
            color="violet"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <QuickLink to="/t2s-api/endpoints" label="Endpoints"   icon="⇄" color="text-violet-300" />
          <QuickLink to="/t2s-api/modules"   label="API Modules" icon="◧" color="text-violet-300" />
        </div>
      </div>

      {/* ── Repo Status ── */}
      <div className="space-y-3">
        <SectionDivider label="Repo Status" color="text-gray-500" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {repos.map(r => (
            <div
              key={r.name}
              className={`card px-3 py-2.5 flex items-center gap-2.5 ${!r.exists ? 'opacity-40' : ''}`}
            >
              <span className={`text-lg leading-none ${r.exists ? 'text-emerald-400' : 'text-gray-600'}`}>
                {r.exists ? '●' : '○'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-200 truncate">{r.displayName || r.name}</div>
                <div className="text-xs text-gray-500 truncate">{r.technology} · {r.type}</div>
              </div>
              {r.priority === 'high' && (
                <span className="text-amber-400 text-xs shrink-0">★</span>
              )}
            </div>
          ))}
        </div>
        {repos.filter(r => !r.exists).length > 0 && (
          <p className="text-gray-600 text-xs">
            {repos.filter(r => !r.exists).length} repo(s) not found locally — clone them to enable scanning.
          </p>
        )}
      </div>

      {/* ── Quick Reference ── */}
      <div className="card p-4 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Reference</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1.5">
            <div className="text-gray-300 font-medium mb-2">CLI Commands</div>
            {[
              ['npm run scan',              'full scan — endpoints + modules + api-modules'],
              ['npm run scan:endpoints',    'rescan all API endpoints'],
              ['npm run scan:modules',      'rescan customer app modules'],
              ['npm run scan:api-modules',  'rescan t2s-api modules'],
              ['npm run dev',               'start frontend + backend dev servers'],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="flex gap-2">
                <code className="text-sky-400 shrink-0">{cmd}</code>
                <span className="text-gray-600">{desc}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="text-gray-300 font-medium mb-2">Architecture</div>
            <div className="space-y-1 text-gray-500">
              <div><span className="text-sky-300">customer_app_2.0</span> — React Native mobile app</div>
              <div><span className="text-violet-300">t2s-api</span> — Primary API (PHP Lumen) <span className="text-amber-400">★</span></div>
              <div><span className="text-emerald-400">t2s-mcs</span> — Microservices layer <span className="text-amber-400">★</span></div>
              <div><span className="text-amber-400">falcon</span> — Falcon backend <span className="text-amber-400">★</span></div>
              <div><span className="text-rose-400">falcon-payment</span> — Payment flows</div>
              <div><span className="text-gray-500">foodhubglobal</span> — Standalone monolith</div>
            </div>
          </div>
        </div>

        {endpoints?.lastScanned && (
          <div className="text-gray-600 text-xs pt-3 border-t border-gray-800">
            Last scanned: {new Date(endpoints.lastScanned).toLocaleString()}
          </div>
        )}
      </div>

    </div>
  );
}
