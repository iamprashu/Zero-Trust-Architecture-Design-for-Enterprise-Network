import { Shield, Fingerprint, Laptop } from 'lucide-react'
import { useState, useEffect } from 'react'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || ''
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || window.location.origin

export default function Login() {
  const [hasWebAuthn, setHasWebAuthn] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkWebAuthn() {
      try {
        if (window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          setHasWebAuthn(available)
        }
      } catch {
        setHasWebAuthn(false)
      }
      setChecking(false)
    }
    checkWebAuthn()
  }, [])

  const handleLogin = () => {
    window.location.href = `${AUTH_URL}/api/login?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
  }

  const handleNewDevice = () => {
    window.location.href = `${AUTH_URL}/api/login?redirect_uri=${encodeURIComponent(REDIRECT_URI)}&new_device=true`
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card animate-fade-in" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'var(--primary)', padding: '16px', borderRadius: '50%', boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)' }}>
            <Shield size={40} color="white" />
          </div>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '10px', background: 'linear-gradient(to right, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Nexus Bank
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
          Zero-Trust Enterprise Banking Architecture. Securely authenticate to continue.
        </p>

        {checking ? (
          <p style={{ color: 'var(--text-muted)' }}>Detecting device capabilities...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hasWebAuthn && (
              <button onClick={handleLogin} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Fingerprint size={20} />
                Secure Login (This Device)
              </button>
            )}
            <button
              onClick={hasWebAuthn ? handleNewDevice : handleLogin}
              className={hasWebAuthn ? "btn-secondary" : "btn-primary"}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: hasWebAuthn ? '0.9rem' : '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: hasWebAuthn ? 'rgba(255,255,255,0.08)' : undefined,
                border: hasWebAuthn ? '1px solid rgba(255,255,255,0.15)' : undefined,
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <Laptop size={18} />
              {hasWebAuthn ? 'Login from New Device (OTP)' : 'Connect via Secure SSO'}
            </button>

            {!hasWebAuthn && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                WebAuthn not available. You will use OTP verification for device security.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
