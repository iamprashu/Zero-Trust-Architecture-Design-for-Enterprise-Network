import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import { Banknote, X } from 'lucide-react';

export default function Loans() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // Modal state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiCall('/accounts');
      setAccounts(res.accounts || []);
    } catch (err) {
      setMessage(`Failed to fetch accounts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleGiveLoan = async (e) => {
    e.preventDefault();
    setMessage('');
    setProcessing(true);

    try {
      const res = await apiCall('/loan', {
        method: 'POST',
        body: JSON.stringify({ accountNumber: selectedAccount.accountNumber, expectedAmount: parseFloat(loanAmount) })
      });
      setMessage(`Success! ${res.message}. New Balance: $${res.newBalance.toFixed(2)}`);
      setLoanAmount('');
      setSelectedAccount(null);
      fetchAccounts(); // refresh list to show updated balance
    } catch (err) {
      setMessage(`Loan Error: ${err.message}`);
      setProcessing(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Banknote color="var(--primary)" /> Loan Management
      </h2>
      
      {message && (
        <div style={{ background: message.includes('failed') || message.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: message.includes('failed') || message.includes('Error') ? '#ef4444' : '#4ade80', padding: '12px', borderLeft: `4px solid ${message.includes('failed') || message.includes('Error') ? '#ef4444' : '#22c55e'}` }}>
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading accounts...</p>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
          No accounts found in the system.
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px', fontWeight: 600 }}>Account No.</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Owner</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Balance</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.accountNumber} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>{acc.accountNumber}</td>
                  <td style={{ padding: '16px' }}>{acc.ownerName}</td>
                  <td style={{ padding: '16px', fontWeight: 'bold' }}>${acc.balance.toFixed(2)}</td>
                  <td style={{ padding: '16px' }}>
                    <button 
                      onClick={() => setSelectedAccount(acc)}
                      className="btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      Give Loan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Give Loan Modal */}
      {selectedAccount && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: '24px', width: '90%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Issue Loan</h3>
              <button onClick={() => { setSelectedAccount(null); setMessage(''); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Issuing loan to {selectedAccount.ownerName} ({selectedAccount.accountNumber}).
            </p>

            <form onSubmit={handleGiveLoan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Loan Amount (USD)</label>
                <input 
                  type="number" 
                  min="0.01" step="0.01"
                  value={loanAmount} 
                  onChange={e => setLoanAmount(e.target.value)}
                  required
                  className="input-field"
                  placeholder="e.g. 5000.00"
                />
              </div>
              
              <button type="submit" className="btn-primary" disabled={processing} style={{ marginTop: '8px' }}>
                {processing ? 'Processing...' : 'Confirm Loan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
