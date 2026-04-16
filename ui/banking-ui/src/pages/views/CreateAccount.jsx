import { useState } from 'react'
import { apiCall } from '../../utils/api'
import { UserPlus } from 'lucide-react'

export default function CreateAccount() {
  const [accountType, setAccountType] = useState('CHECKING')
  const [initialDeposit, setInitialDeposit] = useState(0)
  const [status, setStatus] = useState('')
  const [newAccount, setNewAccount] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    setStatus('Creating...')
    setNewAccount(null)
    
    try {
      const res = await apiCall('/account', {
        method: 'POST',
        body: JSON.stringify({ accountType, initialDeposit: parseFloat(initialDeposit) })
      })
      setStatus('Success!')
      setNewAccount(res.account)
      setInitialDeposit(0)
    } catch (err) {
      setStatus(`Failed: ${err.message}`)
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UserPlus color="var(--primary)" /> 
        Open New Account
      </h3>
      
      <div className="glass-card">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Account Type</label>
            <select 
              value={accountType} 
              onChange={e => setAccountType(e.target.value)}
              className="input-field"
            >
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Initial Deposit (USD)</label>
            <input 
              type="number" 
              min="0"
              value={initialDeposit} 
              onChange={e => setInitialDeposit(e.target.value)}
              required
              className="input-field"
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
            Initialize Account
          </button>
        </form>
        
        {status && (
          <div style={{ 
            marginTop: '20px', padding: '16px', borderRadius: '8px',
            background: status.includes('Failed') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            color: status.includes('Failed') ? 'var(--danger)' : '#4ade80'
          }}>
            {status}
            {newAccount && (
              <div style={{ marginTop: '12px', color: 'var(--text)' }}>
                <strong>Account Number:</strong> {newAccount.accountNumber}<br/>
                <strong>Balance:</strong> ${newAccount.balance.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
