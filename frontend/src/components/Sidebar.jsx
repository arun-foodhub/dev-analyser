import React from 'react';
import { NavLink } from 'react-router-dom';

const GROUPS = [
  {
    id: 'top',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '◈' },
    ],
  },
  {
    id: 'customer-app',
    label: 'Customer App',
    labelColor: 'text-sky-500',
    items: [
      { to: '/customer-app/endpoints', label: 'Endpoints', icon: '⇄' },
      { to: '/customer-app/modules',   label: 'Modules',   icon: '⊞' },
    ],
  },
  {
    id: 't2s-api',
    label: 't2s-api',
    labelColor: 'text-violet-400',
    items: [
      { to: '/t2s-api/endpoints', label: 'Endpoints', icon: '⇄' },
      { to: '/t2s-api/modules',   label: 'API Modules', icon: '◧' },
    ],
  },
  {
    id: 'jira',
    label: 'JIRA',
    labelColor: 'text-blue-400',
    items: [
      { to: '/jira', label: 'Tickets & Tasks', icon: '⬢' },
    ],
  },
  {
    id: 'foodhubglobal',
    label: 'FoodHub Global',
    labelColor: 'text-orange-400',
    items: [
      { to: '/foodhubglobal/modules', label: 'App Structure', icon: '⬡' },
      { to: '/foodhubglobal/tasks',   label: 'Task History',  icon: '◉' },
    ],
  },
  {
    id: 'bottom',
    items: [
      { to: '/repos', label: 'Repos', icon: '⌥' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="text-sky-400 font-bold text-base tracking-tight">Dev Analyser</div>
        <div className="text-gray-500 text-xs mt-0.5">FoodHub Platform</div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {GROUPS.map(group => (
          <div key={group.id}>
            {group.label && (
              <div className={`px-3 pb-1.5 text-xs font-semibold uppercase tracking-widest ${group.labelColor || 'text-gray-600'}`}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon }) => (
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
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <div className="text-gray-600 text-xs">v1.0.0</div>
      </div>
    </aside>
  );
}
