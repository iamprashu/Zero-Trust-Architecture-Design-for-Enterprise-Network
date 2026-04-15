import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2 } from 'lucide-react';

const RolesPage = () => {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentRoleId, setCurrentRoleId] = useState(null);
  
  // Form states
  const [roleName, setRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState([]);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [rRes, pRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/roles', { headers }),
        fetch('http://localhost:5000/api/admin/permissions', { headers })
      ]);
      const rData = await rRes.json();
      const pData = await pRes.json();
      
      setRoles(rData.roles || []);
      setAllPermissions(pData.permissions || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditMode(false);
    setCurrentRoleId(null);
    setRoleName('');
    setSelectedPerms([]);
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditMode(true);
    setCurrentRoleId(role._id);
    setRoleName(role.name);
    setSelectedPerms(role.permissions || []);
    setShowModal(true);
  };

  const handleTogglePerm = (permName) => {
    if (selectedPerms.includes(permName)) {
      setSelectedPerms(selectedPerms.filter(p => p !== permName));
    } else {
      setSelectedPerms([...selectedPerms, permName]);
    }
  };

  const handleSelectAll = (e) => {
    e.preventDefault();
    if (selectedPerms.length === allPermissions.length) {
      setSelectedPerms([]); // Deselect all
    } else {
      setSelectedPerms(allPermissions.map(p => p.name));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const url = editMode 
      ? `http://localhost:5000/api/admin/roles/${currentRoleId}`
      : 'http://localhost:5000/api/admin/roles';
      
    const method = editMode ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: roleName, permissions: selectedPerms })
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch (e) {
      alert('Network Error');
    }
  };

  const handleDelete = async (roleId, roleName) => {
    if(!window.confirm(`Delete role ${roleName}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) {
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch(e) {}
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Role Definitions</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> New Role
        </button>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Permissions Assigned</th>
              <th>Created At</th>
              <th width="150">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r._id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>
                  <div className="flex" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                    {r.permissions && r.permissions.length > 0 ? r.permissions.map(p => (
                      <span key={p} className="badge badge-primary">{p}</span>
                    )) : <span className="text-muted" style={{ fontStyle: 'italic', fontSize:'0.85rem' }}>No permissions</span>}
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="flex gap-2">
                   <button 
                     className="btn btn-secondary" 
                     style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                     onClick={() => openEditModal(r)}
                     disabled={r.name === 'superadmin'}
                   >
                     <Edit2 size={14} />
                   </button>
                   <button 
                     className="btn btn-danger" 
                     style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                     onClick={() => handleDelete(r._id, r.name)}
                     disabled={r.name === 'superadmin' || r.name === 'admin'}
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
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2>{editMode ? 'Edit Role' : 'Create New Role'}</h2>
            <form onSubmit={handleSubmit}>
              
              <div className="form-group mb-4">
                <label>Role Identifier</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  placeholder="e.g. auditor"
                  disabled={editMode && roleName === 'admin'}
                  required
                />
                {!editMode && <p style={{ fontSize:'0.8rem', marginTop:'0.5rem' }}>Must be unique and lowercase.</p>}
              </div>

              <div className="form-group mb-6">
                <div className="flex justify-between items-center mb-2">
                   <label style={{ margin: 0 }}>Map Permissions</label>
                   <button 
                     type="button" 
                     className="btn btn-secondary" 
                     style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                     onClick={handleSelectAll}
                   >
                     {selectedPerms.length === allPermissions.length ? 'Deselect All' : 'Select All'}
                   </button>
                </div>
                
                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {allPermissions.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>No defined permissions found. Create some first!</span>
                  ) : (
                    allPermissions.map(p => (
                      <div key={p.name} className="flex items-center gap-2 mb-2">
                        <input 
                          type="checkbox" 
                          id={`perm-${p.name}`} 
                          checked={selectedPerms.includes(p.name)} 
                          onChange={() => handleTogglePerm(p.name)}
                          style={{ cursor: 'pointer', width: '1rem', height: '1rem', accentColor: 'var(--primary)' }}
                        />
                        <label htmlFor={`perm-${p.name}`} style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', color: 'white' }}>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>- {p.description || 'No description'}</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-4 justify-between">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editMode ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPage;
