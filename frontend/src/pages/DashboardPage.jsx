import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ScanButton from '../components/ScanButton.jsx';

function StatCard({ label, value, sub, color = 'sky' }) {
  const colors = {
    sky:     'border-sky-500/30 text-sky-300',
    emerald: 'border-emerald-500/30 text-emerald-300',
    purple:  'border-purple-500/30 text-purple-300',
    amber:   'border-amber-500/30 text-amber-300',
  };
  return (
    <div className={`card p-4 border-l-2 ${colors[color]}`}>
      <div className={`text-2xl font-bold ${colors[color].split(' ')[1]}`}>{value ?? '—'}</div>
      <div className="text-gray-400 text-xs mt-1">{label}</div>
      {sub && <div className="text-gray-600 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [endpoints, setEndpoints] = useState(null);
  const [modules, setModules]     = useState(null);
  const [repos, setRepos]         = useState([]);

  async function load() {
    const [ep, mod, rp] = await Promise.all([
      axios.get('/api/endpoints').then(r => r.data).catch(() => null),
      axios.get('/api/modules').then(r => r.data).catch(() => null),
      axios.get('/api/repos').then(r => r.data).catch(() => []),
    ]);
    setEndpoints(ep);
    setModules(mod);
    setRepos(rp);
  }

  useEffect(() => { load(); }, []);

  const notScanned = endpoints?.notScanned;
  const availableRepos = repos.filter(r => r.exists);
  const missingRepos   = repos.filter(r => !r.exists);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Dev Analyser</h1>
          <p className="text-gray-500 text-xs mt-0.5">FoodHub platform — cross-repo analysis dashboard</p>
        </div>
        <ScanButton type="all" label="Full Scan" onDone={load} />
      </div>

      {notScanned && (
        <div className="card p-4 border-l-2 border-amber-500/50 bg-amber-500/5">
          <div className="text-amber-300 font-medium text-xs">No scan data yet</div>
          <div className="text-gray-400 text-xs mt-1">
            Click "Full Scan" above or run <code className="text-sky-400">npm run scan</code> in the terminal to analyse all repos.
          </div>
        </div>
      )}

      {/* Repo status */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Repo Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {repos.map(r => (
            <div key={r.name} className={`card px-3 py-2 flex items-center gap-2 ${!r.exists ? 'opacity-50' : ''}`}>
              <span className={r.exists ? 'text-emerald-400' : 'text-red-400'}>{r.exists ? '●' : '○'}</span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-200 truncate">{r.displayName}</div>
                <div className="text-xs text-gray-500 truncate">{r.technology} · {r.type}</div>
              </div>
              {r.priority === 'high' && <span className="ml-auto text-xs text-amber-400">★</span>}
            </div>
          ))}
        </div>
        {missingRepos.length > 0 && (
          <p className="text-gray-600 text-xs mt-2">
            {missingRepos.length} repo(s) not found locally — clone them to enable scanning.
          </p>
        )}
      </div>

      {/* Stats */}
      {!notScanned && (
        <>
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              API Endpoints
              <Link to="/endpoints" className="ml-2 text-sky-500 normal-case">view all →</Link>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Backend Routes"   value={endpoints?.stats?.totalBackendRoutes}  color="emerald" />
              <StatCard label="Frontend Calls"   value={endpoints?.stats?.totalFrontendCalls}  color="sky" />
              <StatCard label="Matched"          value={endpoints?.stats?.matchedRoutes}        color="purple" sub="frontend ↔ backend" />
              <StatCard label="Frontend Only"    value={endpoints?.stats?.frontendOnlyCalls}    color="amber" sub="no backend match" />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              App Modules
              <Link to="/modules" className="ml-2 text-sky-500 normal-case">view all →</Link>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Module Groups"  value={modules?.stats?.totalModules}     color="sky" />
              <StatCard label="Screens"        value={modules?.stats?.totalScreens}     color="emerald" />
              <StatCard label="Components"     value={modules?.stats?.totalComponents}  color="purple" />
              <StatCard label="Services"       value={modules?.stats?.totalServices}    color="amber" />
            </div>
          </div>

          {endpoints?.lastScanned && (
            <p className="text-gray-600 text-xs">
              Last scanned: {new Date(endpoints.lastScanned).toLocaleString()}
            </p>
          )}
        </>
      )}

      {/* Quick reference */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Reference</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
          <div>
            <div className="text-gray-300 font-medium mb-1">CLI Commands</div>
            <div className="space-y-1 font-mono">
              <div><span className="text-sky-400">npm run scan</span> — full scan (endpoints + modules)</div>
              <div><span className="text-sky-400">npm run scan:endpoints</span> — endpoints only</div>
              <div><span className="text-sky-400">npm run scan:modules</span> — modules only</div>
              <div><span className="text-sky-400">npm run dev</span> — start dev servers</div>
            </div>
          </div>
          <div>
            <div className="text-gray-300 font-medium mb-1">Architecture</div>
            <div className="space-y-1">
              <div><span className="text-emerald-400">t2s-api</span> · <span className="text-purple-400">t2s-mcs</span> · <span className="text-amber-400">falcon</span> → customer app</div>
              <div><span className="text-red-400">falcon-payment</span> → payment flows</div>
              <div><span className="text-gray-500">foodhubglobal</span> → standalone monolith</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
