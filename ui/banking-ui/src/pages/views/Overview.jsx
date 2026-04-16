import { useState, useEffect } from 'react'
import { apiCall } from '../../utils/api'
import { Wallet, CreditCard } from 'lucide-react'

export default function Overview() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiCall('/account')
      .then(res => setData(res.account))
      .catch(err => setError(err.message))
  }, [])

  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>
  if (!data) return <div>Loading account data...</div>

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
      
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '12px' }}>
          <Wallet size={32} color="var(--secondary)" />
        </div>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Balance</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', marginTop: '8px' }}>
            ${data.balance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '16px', borderRadius: '12px' }}>
          <CreditCard size={32} color="var(--primary)" />
        </div>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Account Number</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', marginTop: '12px', letterSpacing: '2px' }}>
            {data.accountNumber}
          </div>
        </div>
      </div>
      
    </div>
  )
}
