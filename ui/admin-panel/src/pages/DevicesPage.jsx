import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await api.get(`${import.meta.env.VITE_DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      } else {
        setError('Failed to load devices');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (deviceId) => {
    try {
      await api.patch(`${import.meta.env.VITE_DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices/${deviceId}/approve`);
      fetchDevices();
    } catch (err) {
      alert('Failed to approve device');
    }
  };

  const handleRevoke = async (deviceId) => {
    try {
      await api.patch(`${import.meta.env.VITE_DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices/${deviceId}/revoke`);
      fetchDevices();
    } catch (err) {
      alert('Failed to revoke device');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Device Management</h2>
        <button onClick={fetchDevices} className="btn-primary">Refresh</button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div>Loading devices...</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '1rem' }}>User Email</th>
                <th style={{ padding: '1rem' }}>Device Name</th>
                <th style={{ padding: '1rem' }}>Device ID</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Expires At</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '1rem', textAlign: 'center' }}>No devices found</td>
                </tr>
              ) : (
                devices.map(d => (
                  <tr key={d._id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '1rem' }}>{d.userId?.email || 'Unknown User'}</td>
                    <td style={{ padding: '1rem' }}>{d.deviceName}</td>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.9em' }}>
                      {d.deviceId.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {d.isTrusted ? (
                        <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                          Trusted (Permanent)
                        </span>
                      ) : (
                        <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                          Pending / Temp Session
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {d.expiresAt ? new Date(d.expiresAt).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {!d.isTrusted && (
                        <button onClick={() => handleApprove(d._id)} className="btn-primary" style={{ marginRight: '0.5rem', background: '#10b981' }}>
                          Approve
                        </button>
                      )}
                      <button onClick={() => handleRevoke(d._id)} className="btn-danger" style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
