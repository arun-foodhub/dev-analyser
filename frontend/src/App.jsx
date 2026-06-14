import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EndpointsPage from './pages/EndpointsPage.jsx';
import ModulesPage from './pages/ModulesPage.jsx';
import ReposPage from './pages/ReposPage.jsx';

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/endpoints" element={<EndpointsPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/repos" element={<ReposPage />} />
        </Routes>
      </main>
    </div>
  );
}
