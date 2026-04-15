import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus } from 'lucide-react';

const PermissionsPage = () => {
  const { token } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newPermName, setNewPermName] = useState('');
  const [newPermDesc, setNewPermDesc] = useState('');

  const fetchPermissions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPermissions(data.permissions || []);
    } catch (err) {}
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newPermName, description: newPermDesc })
      });
      if (res.ok) {
        setNewPermName('');
        setNewPermDesc('');
        setShowModal(false);
        fetchPermissions();
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch (e) {}
  };

  const handleDelete = async (id, name) => {
    if(!window.confirm(`Delete permission ${name}? This will cascade and remove it from all roles.`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/permissions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) fetchPermissions();
      else {
        const d = await res.json();
        alert(d.error);
      }
    } catch(e) {}
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Global Permissions</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Permission
        </button>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>Identifier Name</th>
              <th>Description</th>
              <th width="100">Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map(p => (
              <tr key={p._id}>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{p.description || '-'}</td>
                <td>
                   <button 
                     className="btn btn-danger" 
                     style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                     onClick={() => handleDelete(p._id, p.name)}
                   >
                     Delete
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Define Permission</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Identifier Action</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newPermName}
                  onChange={e => setNewPermName(e.target.value)}
                  placeholder="e.g. READ_TRANSACTION"
                  required
                />
              </div>
              <div className="form-group mb-6">
                <label>Description</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newPermDesc}
                  onChange={e => setNewPermDesc(e.target.value)}
                  placeholder="What does this authorize?"
                  required
                />
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

export default PermissionsPage;
