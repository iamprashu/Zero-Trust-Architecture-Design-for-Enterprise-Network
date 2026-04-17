import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import { Edit2, Trash2 } from 'lucide-react';

export default function ManageAccount() {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({ currency: '', type: '' })

  const fetchAccount = async () => {
    try {
      const res = await apiCall('/account')
      setAccount(res.account)
      setEditData({ currency: res.account?.currency || '', type: res.account?.type || '' })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccount()
  }, [])

  const handleEdit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const res = await apiCall('/account', {
        method: 'PUT',
        body: JSON.stringify({ update: editData })
      })
      setMessage(res.message)
      setAccount(res.account)
      setEditMode(false)
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this account?')) return
    setMessage('')
    try {
      const res = await apiCall('/account', { method: 'DELETE' })
      setMessage(res.message)
      fetchAccount()
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    }
  }

  if (loading) return <div>Loading account...</div>

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Manage Account</h2>
      
      {message && <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '12px', borderLeft: '4px solid #3b82f6' }}>{message}</div>}

      <div className="card" style={{ padding: '24px' }}>
        {account?.accountNumber ? (
          <div>
            <h3 style={{ marginBottom: '16px', color: 'var(--muted)' }}>Account Information</h3>
            <p><strong>Account Number:</strong> {account.accountNumber}</p>
            <p><strong>Balance:</strong> ${account.balance}</p>
            <p><strong>Currency:</strong> {account.currency}</p>
            <p><strong>Type:</strong> {account.type || 'CHECKING'}</p>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button className="btn-primary" onClick={() => setEditMode(!editMode)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={16} /> Edit Account
              </button>
              <button onClick={handleDelete} style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
            
            {editMode && (
              <form onSubmit={handleEdit} style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-body)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <h4 style={{ margin: 0 }}>Edit Details</h4>
               <div>
                 <label style={{ display: 'block', marginBottom: '8px' }}>Currency</label>
                 <input className="input-field" value={editData.currency} onChange={e => setEditData({...editData, currency: e.target.value})} required />
               </div>
               <div>
                 <label style={{ display: 'block', marginBottom: '8px' }}>Type</label>
                 <input className="input-field" value={editData.type} onChange={e => setEditData({...editData, type: e.target.value})} required />
               </div>
               <button type="submit" className="btn-secondary" style={{ marginTop: '8px' }}>Save Changes</button>
              </form>
            )}

          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>No active account found. Please create one.</p>
        )}
      </div>
    </div>
  )
}
