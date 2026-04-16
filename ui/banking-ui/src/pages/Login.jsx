import { Shield } from 'lucide-react'

const AUTH_URL = 'http://localhost:5000'
const REDIRECT_URI = 'http://localhost:5002'

export default function Login() {
  const handleLogin = () => {
    window.location.href = `${AUTH_URL}/api/login?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card animate-fade-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px' }}>
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
        <button onClick={handleLogin} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
          Connect via Secure SSO
        </button>
      </div>
    </div>
  )
}
