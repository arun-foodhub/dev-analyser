import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EndpointsPage from './pages/EndpointsPage.jsx';
import ModulesPage from './pages/ModulesPage.jsx';
import ApiModulesPage from './pages/ApiModulesPage.jsx';
import ReposPage from './pages/ReposPage.jsx';

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/repos" element={<ReposPage />} />
          <Route path="/customer-app/endpoints" element={<EndpointsPage key="customer-app-endpoints" repoLabel="Customer App" matchedOnly={true} />} />
          <Route path="/customer-app/modules" element={<ModulesPage key="customer-app-modules" lockedRepo="customer_app_2.0" repoLabel="Customer App" />} />
          <Route path="/t2s-api/endpoints" element={<EndpointsPage key="t2s-api-endpoints" lockedRepo="t2s-api" repoLabel="t2s-api" />} />
          <Route path="/t2s-api/modules" element={<ApiModulesPage key="t2s-api-modules" lockedRepo="t2s-api" repoLabel="t2s-api" />} />
        </Routes>
      </main>
    </div>
  );
}
