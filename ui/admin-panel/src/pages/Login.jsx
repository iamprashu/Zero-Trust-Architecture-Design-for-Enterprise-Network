import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWithAxios } from '../utils/api';
import { Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const Login = () => {
  const { token, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetchWithAxios('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok && data.accessToken) {
        // Direct login success with token
        login(data.accessToken);
      } else {
        setError(data.error || 'Login failed Check credentials and try again.');
      }
    } catch (err) {
      setError('Network connection failed. Ensure Auth service is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div className="flex flex-col items-center mb-6 text-center">
            <div style={{ background: 'rgba(99,102,241,0.1)', padding:'1rem', borderRadius:'50%', marginBottom:'1rem' }}>
              <ShieldCheck size={48} color="var(--primary)" />
            </div>
            <h1 style={{ marginBottom: '0.5rem' }}>Admin Access</h1>
            <p>Sign in to manage Zero-Trust Network</p>
        </div>

        {error && (
          <div className="mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group mb-6">
            <label>Password</label>
            <input 
              type="password" 
              className="form-control" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Sign In as Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
