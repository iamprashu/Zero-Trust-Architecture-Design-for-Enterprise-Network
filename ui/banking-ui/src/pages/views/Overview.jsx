import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import { Trash2, Eye, X } from 'lucide-react';

export default function Overview() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [viewedAccount, setViewedAccount] = useState(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiCall('/accounts');
      setAccounts(res.accounts || []);
    } catch (e) {
      console.error(e);
      setMessage(`Error loading accounts: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDelete = async (accountNumber) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    setMessage('');
    try {
      const res = await apiCall(`/account/${accountNumber}`, { method: 'DELETE' });
      setMessage(res.message);
      fetchAccounts();
    } catch (err) {
      setMessage(`Delete failed: ${err.message}`);
    }
  };

  const handleViewTransactions = async (accountNumber) => {
    setMessage('');
    try {
      const res = await apiCall(`/transactions/${accountNumber}`);
      setTransactions(res.transactions || []);
      setViewedAccount(accountNumber);
    } catch (err) {
      setMessage(`Cannot fetch transactions: ${err.message}`);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Accounts List</h2>
      
      {message && (
        <div style={{ background: message.includes('failed') || message.includes('Cannot') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: message.includes('failed') || message.includes('Cannot') ? '#ef4444' : '#60a5fa', padding: '12px', borderLeft: `4px solid ${message.includes('failed') || message.includes('Cannot') ? '#ef4444' : '#3b82f6'}` }}>
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading accounts...</p>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
          No accounts found. Please create one first.
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px', fontWeight: 600 }}>Account No.</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Owner</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Balance</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.accountNumber} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>{acc.accountNumber}</td>
                  <td style={{ padding: '16px' }}>{acc.ownerName}</td>
                  <td style={{ padding: '16px' }}>{acc.type}</td>
                  <td style={{ padding: '16px', fontWeight: 'bold' }}>${acc.balance.toFixed(2)}</td>
                  <td style={{ padding: '16px', display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => handleViewTransactions(acc.accountNumber)}
                      style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px' }}
                      title="View Transactions"
                    >
                      <Eye size={20} />
                    </button>
                    <button 
                      onClick={() => handleDelete(acc.accountNumber)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      title="Delete Account"
                    >
                      <Trash2 size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions Modal */}
      {viewedAccount && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: '24px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>Transactions for {viewedAccount}</h3>
              <button onClick={() => setViewedAccount(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            {transactions.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No transactions found for this account.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 8px' }}>Date</th>
                    <th style={{ padding: '12px 8px' }}>Type</th>
                    <th style={{ padding: '12px 8px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: 'var(--muted)' }}>{new Date(tx.date).toLocaleString()}</td>
                      <td style={{ padding: '12px 8px', color: tx.type === 'CREDIT' || tx.type === 'LOAN' ? '#4ade80' : '#f87171' }}>{tx.type}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>${tx.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
