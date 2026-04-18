import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWithAxios } from '../utils/api';
import { Users, Shield, ScrollText } from 'lucide-react';

const Dashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState({ users: 0, roles: 0, logs: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [usersRes, rolesRes, logsRes] = await Promise.all([
          fetchWithAxios('http://localhost:5000/api/admin/users', { headers }),
          fetchWithAxios('http://localhost:5000/api/admin/roles', { headers }),
          fetchWithAxios('http://localhost:5000/api/admin/audit-logs', { headers })
        ]);
        
        const users = await usersRes.json();
        const roles = await rolesRes.json();
        const logs = await logsRes.json();
        
        setStats({
          users: users.users?.length || 0,
          roles: roles.roles?.length || 0,
          logs: logs.logs?.length || 0
        });
      } catch (err) {
        console.error('Failed to load stats');
      }
    };
    fetchStats();
  }, [token]);

  return (
    <div>
      <h1>System Overview</h1>
      <p className="mb-6">Welcome to the Zero-Trust Admin Dashboard.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        
        <div className="card flex items-center justify-between">
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>Total Users</p>
            <h2 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--primary)' }}>{stats.users}</h2>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
             <Users size={32} color="var(--primary)" />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>Active Roles</p>
            <h2 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--success)' }}>{stats.roles}</h2>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
             <Shield size={32} color="var(--success)" />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>Audit Events</p>
            <h2 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--warning)' }}>{stats.logs}</h2>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
             <ScrollText size={32} color="var(--warning)" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
