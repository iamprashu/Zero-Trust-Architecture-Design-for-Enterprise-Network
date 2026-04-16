import { useState, useEffect } from 'react'
import { apiCall } from '../../utils/api'

export default function Transactions() {
  const [txs, setTxs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiCall('/transactions')
      .then(res => setTxs(res.transactions))
      .catch(err => setError(err.message))
  }, [])

  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>

  return (
    <div className="glass-card animate-fade-in">
      <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Recent Transactions</h3>
      <table className="table-glass">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {txs.map(tx => (
            <tr key={tx.id}>
              <td>#{tx.id}</td>
              <td>{new Date(tx.date).toLocaleString()}</td>
              <td>
                <span style={{
                  padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                  background: tx.type === 'CREDIT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: tx.type === 'CREDIT' ? 'var(--success)' : 'var(--danger)'
                }}>
                  {tx.type}
                </span>
              </td>
              <td style={{ fontWeight: 'bold', color: tx.type === 'CREDIT' ? 'var(--success)' : 'white' }}>
                {tx.type === 'DEBIT' || tx.type === 'TRANSFER' ? '-' : '+'}${tx.amount.toFixed(2)}
              </td>
            </tr>
          ))}
          {txs.length === 0 && (
            <tr><td colSpan="4" style={{ textAlign: 'center', opacity: 0.5 }}>No recorded transactions.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
