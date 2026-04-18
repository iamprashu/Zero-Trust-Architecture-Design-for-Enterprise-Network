import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWithAxios } from '../utils/api';

const AuditLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetchWithAxios('http://localhost:5000/api/admin/audit-logs', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {}
    };
    fetchLogs();
  }, [token]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>System Security Logs</h1>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User Context</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log._id}>
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>
                  <span className="badge badge-primary">{log.action}</span>
                </td>
                <td>
                  {log.userId ? (
                    <div className="flex items-center gap-2">
                       <span style={{ fontWeight: 600 }}>{log.userId.email}</span>
                       <span className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{log.userId.role}</span>
                    </div>
                  ) : <span className="text-muted">System/Anonymous</span>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="3" className="text-center" style={{ padding: '2rem' }}>No audit trails found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
