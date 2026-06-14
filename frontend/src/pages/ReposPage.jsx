import React, { useEffect, useState } from 'react';
import axios from 'axios';

const TYPE_COLOR = {
  frontend: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  backend:  'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  monolith: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
};

const TECH_LABEL = {
  'react-native': 'React Native',
  nodejs: 'Node.js',
  php: 'PHP',
};

export default function ReposPage() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/repos')
      .then(r => setRepos(r.data))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-sm">Loading...</div>;

  const available = repos.filter(r => r.exists);
  const missing   = repos.filter(r => !r.exists);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-100">Repos</h1>
        <p className="text-gray-500 text-xs mt-0.5">
          {available.length} available · {missing.length} not found locally
        </p>
      </div>

      <div className="space-y-3">
        {repos.map(r => (
          <div key={r.name} className={`card p-4 ${!r.exists ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-100 font-medium">{r.displayName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLOR[r.type] || 'text-gray-400'}`}>
                    {r.type}
                  </span>
                  <span className="text-xs text-gray-500">{TECH_LABEL[r.technology] || r.technology}</span>
                  {r.priority === 'high' && <span className="text-xs text-amber-400">★ high priority</span>}
                  {r.standalone && <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">standalone</span>}
                </div>
                <div className="text-gray-400 text-xs mt-1">{r.description}</div>
                {r.notes && (
                  <div className="text-amber-400/70 text-xs mt-1 italic">{r.notes}</div>
                )}
                <div className="font-mono text-gray-600 text-xs mt-2">{r.localPath}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-sm ${r.exists ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.exists ? '● Available' : '○ Not found'}
                </div>
                {r.gitUrl && (
                  <div className="text-xs text-gray-600 mt-1 font-mono max-w-xs truncate">{r.gitUrl}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="card p-4 border-l-2 border-amber-500/50">
          <div className="text-amber-300 font-medium text-xs mb-2">Missing repos — how to clone</div>
          <div className="space-y-1 font-mono text-xs text-gray-400">
            {missing.map(r => (
              <div key={r.name}>
                <span className="text-gray-600">cd ~/Desktop/Workspace && </span>
                <span className="text-sky-400">git clone {r.gitUrl}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
