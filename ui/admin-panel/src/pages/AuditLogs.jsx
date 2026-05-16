import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWithAxios } from '../utils/api';

// ── Action badge color mapping ──────────────────────────────────────────────
const ACTION_COLORS = {
  login: { bg: '#10b981', label: 'Login' },
  logout: { bg: '#6b7280', label: 'Logout' },
  oauth_authorize: { bg: '#3b82f6', label: 'OAuth Authorize' },
  token_exchange: { bg: '#8b5cf6', label: 'Token Exchange' },
  token_replay_detected: { bg: '#ef4444', label: 'Token Replay ⚠' },
  webauthn_login: { bg: '#06b6d4', label: 'WebAuthn Login' },
  webauthn_register: { bg: '#0891b2', label: 'WebAuthn Register' },
  security_incident: { bg: '#f59e0b', label: 'Security Incident' },
  auto_blocked_risk_score: { bg: '#dc2626', label: 'Auto-Blocked' },
  admin_security_unlock: { bg: '#22c55e', label: 'Admin Unlock' },
  admin_temp_device_revoked: { bg: '#f97316', label: 'Device Revoked' },
};

const getActionStyle = (action) => {
  const config = ACTION_COLORS[action] || { bg: '#64748b', label: action };
  return config;
};

const AuditLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [actionTypes, setActionTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterIp, setFilterIp] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithAxios('/api/admin/audit-logs/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    }
  }, [token]);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterAction && filterAction !== 'all') params.set('action', filterAction);
      if (filterIp) params.set('ip', filterIp);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const res = await fetchWithAxios(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
      setActionTypes(data.actionTypes || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filterAction, filterIp, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchStats();
    fetchLogs(1);
  }, [fetchStats, fetchLogs]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchLogs(newPage);
  };

  const handleFilter = () => {
    setCurrentPage(1);
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setFilterAction('all');
    setFilterIp('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
    setTimeout(() => fetchLogs(1), 0);
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Timestamp', 'Action', 'User', 'Role', 'IP Address', 'Country', 'City', 'User Agent', 'Details'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.action,
      log.userId?.email || 'System',
      log.userId?.role || '-',
      log.ipAddress || '-',
      log.geoLocation?.country || '-',
      log.geoLocation?.city || '-',
      (log.userAgent || '-').replace(/,/g, ' '),
      (log.details || '-').replace(/,/g, ' ')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Security Audit Dashboard</h1>
        <button onClick={exportCSV} style={{
          padding: '0.5rem 1rem',
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📥 Export CSV
        </button>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Total Events" value={stats.totalEvents} color="#3b82f6" />
          <StatCard label="Today" value={stats.todayEvents} color="#10b981" />
          <StatCard label="This Week" value={stats.weekEvents} color="#8b5cf6" />
          <StatCard label="Security Events (30d)" value={stats.securityEvents} color="#ef4444" />
          <StatCard label="Unique IPs Today" value={stats.uniqueIpsToday} color="#f59e0b" />
          <StatCard label="Last 30 Days" value={stats.monthEvents} color="#06b6d4" />
        </div>
      )}

      {/* ── Top IPs & Locations ──────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Top IPs */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>🔝 Top IP Addresses (30 days)</h3>
            {stats.topIps?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {stats.topIps.slice(0, 6).map((ip, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'var(--bg-hover)' }}>
                    <code style={{ fontSize: '0.8rem' }}>{ip._id}</code>
                    <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{ip.count}</span>
                  </div>
                ))}
              </div>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No IP data yet</span>}
          </div>

          {/* Login Locations */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>🌍 Login Locations (30 days)</h3>
            {stats.loginLocations?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {stats.loginLocations.slice(0, 6).map((loc, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'var(--bg-hover)' }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      {loc._id.city || 'Unknown'}, {loc._id.country || 'Unknown'}
                    </span>
                    <span className="badge" style={{ fontSize: '0.75rem', background: '#3b82f6', color: '#fff' }}>{loc.count}</span>
                  </div>
                ))}
              </div>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No geo data yet</span>}
          </div>
        </div>
      )}

      {/* ── Activity Timeline ────────────────────────────────────────────── */}
      {stats?.timeline?.length > 0 && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>📊 7-Day Activity Timeline</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '100px' }}>
            {stats.timeline.map((day, i) => {
              const maxVal = Math.max(...stats.timeline.map(d => d.total), 1);
              const height = Math.max((day.total / maxVal) * 80, 4);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{day.total}</span>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {day.security > 0 && (
                      <div style={{
                        height: `${Math.max((day.security / maxVal) * 80, 2)}px`,
                        background: '#ef4444',
                        borderRadius: '3px 3px 0 0'
                      }} title={`${day.security} security events`} />
                    )}
                    <div style={{
                      height: `${height}px`,
                      background: 'linear-gradient(to top, #3b82f6, #8b5cf6)',
                      borderRadius: day.security > 0 ? '0 0 3px 3px' : '3px'
                    }} title={`${day.logins} logins`} />
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    {new Date(day._id).toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '2px', display: 'inline-block' }} /> Events
            </span>
            <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px', display: 'inline-block' }} /> Security
            </span>
          </div>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Action</label>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem', minWidth: '160px' }}
          >
            <option value="all">All Actions</option>
            {actionTypes.map(a => (
              <option key={a} value={a}>{getActionStyle(a).label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP Address</label>
          <input
            value={filterIp}
            onChange={e => setFilterIp(e.target.value)}
            placeholder="Filter by IP..."
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem', width: '140px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From</label>
          <input
            type="date"
            value={filterStartDate}
            onChange={e => setFilterStartDate(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={e => setFilterEndDate(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem' }}
          />
        </div>

        <button onClick={handleFilter} style={{
          padding: '0.45rem 1rem',
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          🔍 Filter
        </button>

        <button onClick={handleClearFilters} style={{
          padding: '0.45rem 1rem',
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem'
        }}>
          ✕ Clear
        </button>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {pagination.total} results
        </span>
      </div>

      {/* ── Logs Table ───────────────────────────────────────────────────── */}
      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>IP Address</th>
              <th>Location</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center" style={{ padding: '2rem' }}>
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center" style={{ padding: '2rem' }}>No audit logs found matching your filters.</td>
              </tr>
            ) : (
              logs.map(log => {
                const actionConfig = getActionStyle(log.action);
                const isSecurityEvent = ['security_incident', 'auto_blocked_risk_score', 'token_replay_detected'].includes(log.action);
                return (
                  <tr key={log._id} style={isSecurityEvent ? { background: 'rgba(239,68,68,0.08)' } : {}}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#fff',
                        background: actionConfig.bg,
                        whiteSpace: 'nowrap'
                      }}>
                        {actionConfig.label}
                      </span>
                    </td>
                    <td>
                      {log.userId ? (
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.userId.email}</span>
                          <span className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{log.userId.role}</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>System</span>}
                    </td>
                    <td>
                      {log.ipAddress ? (
                        <code style={{ fontSize: '0.8rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--bg-hover)' }}>
                          {log.ipAddress}
                        </code>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {log.geoLocation?.country ? (
                        <span>
                          {log.geoLocation.city && `${log.geoLocation.city}, `}
                          {log.geoLocation.country}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
            style={{
              padding: '0.4rem 0.8rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              opacity: pagination.page <= 1 ? 0.4 : 1
            }}
          >
            ← Prev
          </button>

          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            let pageNum;
            if (pagination.totalPages <= 7) {
              pageNum = i + 1;
            } else if (pagination.page <= 4) {
              pageNum = i + 1;
            } else if (pagination.page >= pagination.totalPages - 3) {
              pageNum = pagination.totalPages - 6 + i;
            } else {
              pageNum = pagination.page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                style={{
                  padding: '0.4rem 0.7rem',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: pageNum === pagination.page ? 'var(--primary)' : 'var(--bg-card)',
                  color: pageNum === pagination.page ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: pageNum === pagination.page ? 700 : 400,
                  fontSize: '0.85rem'
                }}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
            style={{
              padding: '0.4rem 0.8rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              opacity: pagination.page >= pagination.totalPages ? 0.4 : 1
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

// ── Stat Card Component ──────────────────────────────────────────────────────
const StatCard = ({ label, value, color }) => (
  <div className="card" style={{
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    borderLeft: `3px solid ${color}`,
    borderRadius: '8px'
  }}>
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
    <span style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value?.toLocaleString() || 0}</span>
  </div>
);

export default AuditLogs;
