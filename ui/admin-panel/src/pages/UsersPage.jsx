import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus } from 'lucide-react';

const UsersPage = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [uRes, rRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/users', { headers }),
        fetch('http://localhost:5000/api/admin/roles', { headers })
      ]);
      const uData = await uRes.json();
      const rData = await rRes.json();
      
      setUsers(uData.users || []);
      setRoles(rData.roles || []);
      if (!newRole && rData.roles && rData.roles.length > 0) {
        setNewRole(rData.roles[0].name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole })
      });
      if (res.ok) {
        setNewEmail('');
        setNewPassword('');
        setShowModal(false);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create user');
      }
    } catch (err) {
      alert('Error creating user');
    }
  };

  const handleRoleChange = async (userId, newRoleVal) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: newRoleVal })
      });
      if (res.ok) {
        fetchData(); // Refresh
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update role');
      }
    } catch (err) {
      alert('Error updating role');
    }
  };

  const toggleStatus = async (userId, currentStatus, type) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/disable`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, disabled: !currentStatus })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };
  
  const resetRisk = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/risk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, riskScore: 0 })
      });
      if (res.ok) fetchData();
    } catch (e) {}
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New User
        </button>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Role</th>
              <th>Risk Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {u._id.slice(-6)}
                </td>
                <td style={{ fontWeight: 500 }}>{u.email}</td>
                <td>
                  <select 
                    className="form-control" 
                    style={{ padding: '0.4rem', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'white', borderRadius: '4px', maxWidth: '140px' }}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                    disabled={u.role === 'superadmin'}
                  >
                    <option value="superadmin" disabled>superadmin</option>
                    {roles.map(r => (
                      <option key={r._id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.riskScore > 50 ? 'badge-danger' : (u.riskScore > 0 ? 'badge-warning' : 'badge-success')}`} style={{ background: u.riskScore > 0 && u.riskScore <= 50 ? 'rgba(245, 158, 11, 0.1)' : '' }}>
                    {u.riskScore}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.disabled || u.isBlocked ? 'badge-danger' : 'badge-success'}`}>
                    {u.disabled ? 'Disabled' : (u.isBlocked ? 'Blocked' : 'Active')}
                  </span>
                </td>
                <td className="flex gap-2">
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                    onClick={() => toggleStatus(u._id, u.disabled, 'disabled')}
                    disabled={u.role === 'superadmin'}
                  >
                    {u.disabled ? 'Enable' : 'Disable'}
                  </button>
                  {u.riskScore > 0 && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'white' }}
                      onClick={() => resetRisk(u._id)}
                    >
                      Reset Risk
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center" style={{ padding: '2rem' }}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Email / Username</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="e.g. user@bank.local"
                  required
                />
              </div>
              <div className="form-group">
                <label>Secure Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="minimum 6 characters"
                  required
                />
              </div>
              <div className="form-group mb-6">
                <label>Assign Role</label>
                <select 
                  className="form-control" 
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a role...</option>
                  {roles.map(r => (
                    <option key={r._id} value={r.name}>{r.name}</option>
                  ))}
                  <option value="superadmin">superadmin</option>
                </select>
              </div>
              <div className="flex gap-4 justify-between">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
