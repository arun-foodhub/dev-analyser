import React, { useState } from 'react';
import axios from 'axios';

export default function ScanButton({ type = 'all', onDone, label }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleScan() {
    setLoading(true);
    setStatus(null);
    try {
      const { data } = await axios.post(`/api/scan/${type}`);
      setStatus({ ok: true, msg: 'Scan complete' });
      if (onDone) onDone(data);
    } catch (err) {
      setStatus({ ok: false, msg: err?.response?.data?.error || 'Scan failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleScan}
        disabled={loading}
        className="btn-primary flex items-center gap-1.5"
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block">↻</span>
            Scanning...
          </>
        ) : (
          <>⟳ {label || `Scan ${type}`}</>
        )}
      </button>
      {status && (
        <span className={`text-xs ${status.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {status.ok ? '✓' : '✗'} {status.msg}
        </span>
      )}
    </div>
  );
}
