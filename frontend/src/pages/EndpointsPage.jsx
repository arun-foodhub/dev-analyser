import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import MethodBadge from '../components/MethodBadge.jsx';
import ScanButton from '../components/ScanButton.jsx';

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function EndpointRow({ ep, isExpanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
      >
        <td className="px-3 py-2">
          <MethodBadge method={ep.method} />
        </td>
        <td className="px-3 py-2 font-mono text-xs text-gray-200 max-w-xs">
          <span className="truncate block">{ep.path}</span>
        </td>
        <td className="px-3 py-2">
          <span className="text-xs text-gray-400">{ep.repo}</span>
        </td>
        <td className="px-3 py-2">
          <span className="text-xs text-gray-500 font-mono truncate block max-w-xs">
            {ep.file}:{ep.line}
          </span>
        </td>
        <td className="px-3 py-2">
          {ep.matchedFrontendCalls?.length > 0 ? (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
              {ep.matchedFrontendCalls.length} match{ep.matchedFrontendCalls.length !== 1 ? 'es' : ''}
            </span>
          ) : ep.source === 'frontend' ? (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">frontend only</span>
          ) : (
            <span className="text-xs text-gray-600">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-900/80 border-b border-gray-800">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

              <div>
                <div className="text-gray-500 uppercase tracking-wider text-xs mb-1">Details</div>
                <div className="space-y-1 text-gray-400">
                  <div><span className="text-gray-500">Repo:</span> <span className="text-gray-200">{ep.repo}</span></div>
                  <div><span className="text-gray-500">Tech:</span> <span className="text-gray-200">{ep.technology || 'unknown'}</span></div>
                  <div><span className="text-gray-500">File:</span> <span className="font-mono text-sky-400">{ep.file}</span></div>
                  <div><span className="text-gray-500">Line:</span> <span className="text-gray-200">{ep.line}</span></div>
                  <div><span className="text-gray-500">Normalized path:</span> <span className="font-mono text-gray-300">{ep.normalizedPath}</span></div>
                </div>
              </div>

              {ep.matchedFrontendCalls?.length > 0 && (
                <div>
                  <div className="text-gray-500 uppercase tracking-wider text-xs mb-1">Frontend Usages</div>
                  <div className="space-y-2">
                    {ep.matchedFrontendCalls.map((fc, i) => (
                      <div key={i} className="bg-gray-800 rounded p-2">
                        <div className="text-gray-300 font-mono truncate">{fc.file}:{fc.line}</div>
                        <div className="text-gray-500 font-mono text-xs mt-0.5 truncate">{fc.rawCall}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ep.mockPayload && (
                <div>
                  <div className="text-gray-500 uppercase tracking-wider text-xs mb-1">Mock Payload</div>
                  <pre className="bg-gray-800 rounded p-2 text-gray-300 text-xs overflow-x-auto">
                    {JSON.stringify(ep.mockPayload, null, 2)}
                  </pre>
                </div>
              )}

              {ep.mockResponse && (
                <div>
                  <div className="text-gray-500 uppercase tracking-wider text-xs mb-1">Mock Response</div>
                  <pre className="bg-gray-800 rounded p-2 text-gray-300 text-xs overflow-x-auto">
                    {JSON.stringify(ep.mockResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function EndpointsPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [method, setMethod]     = useState('ALL');
  const [repoFilter, setRepo]   = useState('ALL');
  const [tab, setTab]           = useState('backend'); // backend | frontend
  const [expanded, setExpanded] = useState(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  async function load() {
    setLoading(true);
    const res = await axios.get('/api/endpoints').catch(() => ({ data: null }));
    setData(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const repos = useMemo(() => {
    if (!data?.endpoints) return ['ALL'];
    const set = new Set(data.endpoints.map(e => e.repo));
    return ['ALL', ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    const source = tab === 'backend' ? (data?.endpoints || []) : (data?.frontendOnlyCalls || []);
    return source.filter(ep => {
      if (method !== 'ALL' && ep.method !== method) return false;
      if (repoFilter !== 'ALL' && ep.repo !== repoFilter) return false;
      if (showUnmatched && tab === 'backend' && ep.matchedFrontendCalls?.length > 0) return false;
      const q = search.toLowerCase();
      if (q && !ep.path.toLowerCase().includes(q) && !ep.file?.toLowerCase().includes(q) && !ep.repo?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, method, repoFilter, tab, showUnmatched]);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">API Endpoints</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {data?.stats?.totalBackendRoutes ?? 0} backend routes · {data?.stats?.totalFrontendCalls ?? 0} frontend calls
          </p>
        </div>
        <ScanButton type="endpoints" label="Scan Endpoints" onDone={load} />
      </div>

      {data?.notScanned && (
        <div className="card p-3 border-l-2 border-amber-500/50 text-amber-300 text-xs">
          No data yet — run a scan first.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 pb-2">
        {[
          { id: 'backend',  label: `Backend Routes (${data?.stats?.totalBackendRoutes ?? 0})` },
          { id: 'frontend', label: `Frontend Only (${data?.stats?.frontendOnlyCalls ?? 0})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
              tab === t.id ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input w-64"
          placeholder="Search path, file, repo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select className="input" value={repoFilter} onChange={e => setRepo(e.target.value)}>
          {repos.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {tab === 'backend' && (
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnmatched}
              onChange={e => setShowUnmatched(e.target.checked)}
              className="accent-sky-500"
            />
            Unmatched only
          </label>
        )}

        <span className="text-gray-600 text-xs ml-auto">{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th className="px-3 py-2 text-left w-20">Method</th>
              <th className="px-3 py-2 text-left">Path</th>
              <th className="px-3 py-2 text-left w-36">Repo</th>
              <th className="px-3 py-2 text-left">File</th>
              <th className="px-3 py-2 text-left w-32">Frontend</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-600 text-xs">
                  No results
                </td>
              </tr>
            ) : (
              filtered.map(ep => (
                <EndpointRow
                  key={ep.id}
                  ep={ep}
                  isExpanded={expanded === ep.id}
                  onToggle={() => setExpanded(expanded === ep.id ? null : ep.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
