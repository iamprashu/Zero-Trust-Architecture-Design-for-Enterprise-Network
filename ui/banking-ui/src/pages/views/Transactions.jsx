import { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import { ArrowLeftRight } from 'lucide-react';

export default function Transactions() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [type, setType] = useState('DEBIT');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await apiCall('/accounts');
        setAccounts(res.accounts || []);
        if (res.accounts && res.accounts.length > 0) {
          setSelectedAccount(res.accounts[0].accountNumber);
        }
      } catch (err) {
        console.error('Failed to fetch accounts', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setProcessing(true);

    try {
      const res = await apiCall('/transactions', {
        method: 'POST',
        body: JSON.stringify({ accountNumber: selectedAccount, type, amount: parseFloat(amount) })
      });
      setMessage(`Success! ${res.message}. New Balance: $${res.newBalance.toFixed(2)}`);
      setAmount('');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ArrowLeftRight color="var(--primary)" /> 
        New Transaction
      </h3>

      {accounts.length === 0 ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
          No accounts available to transact on. Please create one.
        </div>
      ) : (
        <div className="glass-card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Select Account</label>
              <select 
                value={selectedAccount} 
                onChange={e => setSelectedAccount(e.target.value)}
                className="input-field"
                required
              >
                {accounts.map(acc => (
                  <option key={acc.accountNumber} value={acc.accountNumber}>
                    {acc.accountNumber} - {acc.ownerName} (${acc.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Transaction Type</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value)}
                className="input-field"
                required
              >
                <option value="DEBIT">Debit (Withdrawal)</option>
                <option value="CREDIT">Credit (Deposit)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Amount (USD)</label>
              <input 
                type="number" 
                min="0.01" step="0.01"
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                required
                className="input-field"
                placeholder="e.g. 150.00"
              />
            </div>
            
            <button type="submit" className="btn-primary" disabled={processing} style={{ marginTop: '8px' }}>
              {processing ? 'Processing...' : `Execute ${type}`}
            </button>
          </form>
          
          {message && (
            <div style={{ 
              marginTop: '20px', padding: '16px', borderRadius: '8px',
              background: message.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              color: message.includes('Error') ? 'var(--danger)' : '#4ade80'
            }}>
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
