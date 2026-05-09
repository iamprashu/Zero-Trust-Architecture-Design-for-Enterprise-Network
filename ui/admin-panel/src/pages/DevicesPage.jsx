import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Monitor, Smartphone, Trash2, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

const DevicesPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/users');
      const data = res.ok ? await res.json() : res.data;
      setUsers(data?.users || []);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async (userId) => {
    try {
      setDevicesLoading(true);
      setError(null);
      setSuccess(null);
      const res = await api.get(`/admin/users/${userId}/devices`);
      const data = res.ok ? await res.json() : res.data;
      setDevices(data?.devices || []);
      setSelectedUser(userId);
    } catch (err) {
      setError('Failed to load devices for this user');
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleRevokeDevice = async (credentialId) => {
    if (!window.confirm('Revoke this device? The user will need to re-register or use OTP on next login.')) return;
    try {
      setError(null);
      const res = await api.delete(`/admin/devices/${credentialId}`);
      const data = res.ok ? await res.json() : res.data;
      setSuccess(data?.message || 'Device revoked successfully');
      fetchDevices(selectedUser);
    } catch (err) {
      setError('Failed to revoke device');
    }
  };

  const handleRevokeAll = async (userId) => {
    if (!window.confirm('Revoke ALL devices for this user? They will be forced to re-register on next login.')) return;
    try {
      setError(null);
      const res = await api.delete(`/admin/users/${userId}/devices`);
      const data = res.ok ? await res.json() : res.data;
      setSuccess(data?.message || 'All devices revoked');
      fetchDevices(userId);
    } catch (err) {
      setError('Failed to revoke devices');
    }
  };

  const selectedUserObj = users.find(u => u._id === selectedUser);

  const formatDeviceName = (name) => {
    if (!name) return 'Unknown Device';
    // Extract meaningful part from user agent
    if (name.includes('Windows')) return '💻 Windows PC';
    if (name.includes('Mac')) return '💻 macOS';
    if (name.includes('Linux')) return '💻 Linux';
    if (name.includes('Android')) return '📱 Android';
    if (name.includes('iPhone') || name.includes('iPad')) return '📱 iOS';
    return name.substring(0, 40) + '...';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={24} />
          Device Management (WebAuthn)
        </h2>
        <button onClick={fetchUsers} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading users...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
          {/* User list */}
          <div className="card" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#94a3b8' }}>Select a user to view devices</h3>
            {users.map(u => (
              <div
                key={u._id}
                onClick={() => fetchDevices(u._id)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: selectedUser === u._id ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: selectedUser === u._id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{u.email}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Role: {u.role} {u.isBlocked && '🔒 Blocked'}
                </div>
              </div>
            ))}
          </div>

          {/* Device list */}
          <div className="card">
            {!selectedUser ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <Monitor size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <p>Select a user from the list to view their registered devices.</p>
              </div>
            ) : devicesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading devices...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>
                    Devices for <span style={{ color: 'var(--primary)' }}>{selectedUserObj?.email}</span>
                  </h3>
                  {devices.length > 0 && (
                    <button
                      onClick={() => handleRevokeAll(selectedUser)}
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.3)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash2 size={14} /> Revoke All
                    </button>
                  )}
                </div>

                {devices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    <AlertTriangle size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No WebAuthn devices registered.</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>User will be prompted to register on next login.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {devices.map(d => (
                      <div
                        key={d._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Smartphone size={16} style={{ color: '#10b981' }} />
                            {formatDeviceName(d.deviceName)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                            ID: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '3px' }}>
                              {d.credentialId?.substring(0, 16)}...
                            </code>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                            Registered: {d.createdAt ? new Date(d.createdAt).toLocaleString() : 'Unknown'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeDevice(d._id)}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Trash2 size={14} /> Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
