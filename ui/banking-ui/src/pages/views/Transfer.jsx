import { useState } from 'react'
import { apiCall } from '../../utils/api'
import { Send } from 'lucide-react'

export default function Transfer() {
  const [dest, setDest] = useState('')
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    
    try {
      await apiCall('/transfer', {
        method: 'POST',
        body: JSON.stringify({ destination: dest, expectedAmount: parseFloat(amount) })
      })
      
      setMsg({ text: `Successfully transferred $${amount} to ${dest}`, type: 'success' })
      setDest('')
      setAmount('')
    } catch(err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '12px', borderRadius: '12px' }}>
          <Send size={24} color="var(--primary)" />
        </div>
        <h2 style={{ margin: 0 }}>Transfer Funds</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Destination Account</label>
          <input 
            type="text" 
            className="input-glass" 
            placeholder="e.g. 9876543210" 
            required 
            value={dest}
            onChange={e => setDest(e.target.value)}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Amount ($)</label>
          <input 
            type="number" 
            className="input-glass" 
            placeholder="0.00" 
            min="1" 
            step="0.01"
            required 
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        {msg.text && (
          <div style={{ 
            padding: '12px', borderRadius: '8px', fontSize: '0.9rem',
            background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${msg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`
          }}>
            {msg.text}
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
          Confirm Transfer
        </button>
      </form>
    </div>
  )
}
