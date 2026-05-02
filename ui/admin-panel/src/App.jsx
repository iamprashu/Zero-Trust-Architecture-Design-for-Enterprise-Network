import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import AdminLayout from './layouts/AdminLayout';
import DeviceOtpModal from './components/DeviceOtpModal';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import PermissionsPage from './pages/PermissionsPage';
import AuditLogs from './pages/AuditLogs';
import DevicesPage from './pages/DevicesPage';

const ProtectedRoute = ({ children }) => {
  const { token, user } = useAuth();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Note: Only superadmin or role with Z_ALL could truly access everything, 
  // but we leave fine-grained RBAC to the backend in this general Admin UI.
  return children;
};

function App() {
  return (
    <>
      <DeviceOtpModal />
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default App;
