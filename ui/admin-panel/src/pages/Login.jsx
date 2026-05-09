import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Fingerprint, Laptop } from 'lucide-react';

const AUTH_URL = import.meta.env.VITE_AUTH_URL || '';
const REDIRECT_URI = (import.meta.env.VITE_REDIRECT_URI || window.location.origin) + '/admin';

const Login = () => {
  const { token } = useAuth();
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        if (window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setHasWebAuthn(available);
        }
      } catch { setHasWebAuthn(false); }
      setChecking(false);
    }
    check();
  }, []);

  if (token) return <Navigate to="/dashboard" replace />;

  const handleLogin = () => {
    window.location.href = `${AUTH_URL}/api/login?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  };

  const handleNewDevice = () => {
    window.location.href = `${AUTH_URL}/api/login?redirect_uri=${encodeURIComponent(REDIRECT_URI)}&new_device=true`;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        <div className="flex flex-col items-center mb-6 text-center">
            <div style={{ background: 'rgba(99,102,241,0.1)', padding:'1rem', borderRadius:'50%', marginBottom:'1rem' }}>
              <ShieldCheck size={48} color="var(--primary)" />
            </div>
            <h1 style={{ marginBottom: '0.5rem' }}>Admin Access</h1>
            <p>Sign in to manage Zero-Trust Network</p>
        </div>

        {checking ? (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Detecting device capabilities...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hasWebAuthn && (
              <button onClick={handleLogin} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Fingerprint size={18} />
                Secure Login (This Device)
              </button>
            )}
            <button
              onClick={hasWebAuthn ? handleNewDevice : handleLogin}
              className="btn"
              style={{
                width: '100%',
                background: hasWebAuthn ? 'rgba(255,255,255,0.08)' : 'var(--primary)',
                color: 'white',
                border: hasWebAuthn ? '1px solid rgba(255,255,255,0.15)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <Laptop size={16} />
              {hasWebAuthn ? 'Login from New Device (OTP)' : 'Sign In as Admin'}
            </button>

            {!hasWebAuthn && (
              <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', marginTop: '4px' }}>
                WebAuthn not available on this device. You will use OTP verification.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
