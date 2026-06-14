import React from 'react';

const MAP = {
  GET:    'badge-get',
  POST:   'badge-post',
  PUT:    'badge-put',
  PATCH:  'badge-patch',
  DELETE: 'badge-delete',
};

export default function MethodBadge({ method }) {
  const cls = MAP[method?.toUpperCase()] || 'bg-gray-700 text-gray-300 border border-gray-600';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${cls}`}>
      {method}
    </span>
  );
}
