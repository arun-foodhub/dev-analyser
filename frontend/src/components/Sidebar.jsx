import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '◈' },
  { to: '/endpoints', label: 'API Endpoints', icon: '⇄' },
  { to: '/modules',   label: 'App Modules',  icon: '⊞' },
  { to: '/repos',     label: 'Repos',        icon: '⌥' },
];

export default function Sidebar() {
  return (
    <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="text-sky-400 font-bold text-base tracking-tight">Dev Analyser</div>
        <div className="text-gray-500 text-xs mt-0.5">FoodHub Platform</div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors ${
                isActive
                  ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <span className="text-base leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <div className="text-gray-600 text-xs">v1.0.0</div>
      </div>
    </aside>
  );
}
