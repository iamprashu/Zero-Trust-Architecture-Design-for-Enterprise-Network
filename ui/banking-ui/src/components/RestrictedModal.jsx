import { useState, useEffect } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

export default function RestrictedModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleRestrictedAccess = (e) => {
      setErrorMessage(e.detail)
      setIsOpen(true)
    }
    
    window.addEventListener('restricted-access', handleRestrictedAccess)
    return () => window.removeEventListener('restricted-access', handleRestrictedAccess)
  }, [])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass-card" style={{
        maxWidth: '450px', width: '90%', padding: '32px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
        textAlign: 'center', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '16px', background: 'rgba(30, 41, 59, 0.95)'
      }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)', display: 'flex',
          justifyContent: 'center', alignItems: 'center',
          animation: 'pulse 2s infinite'
        }}>
          <ShieldAlert size={48} color="var(--danger)" />
        </div>
        
        <h2 style={{ margin: 0, color: 'var(--danger)', fontSize: '1.8rem', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Restricted Area
        </h2>
        
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '16px', borderRadius: '8px', color: '#f87171', width: '100%',
          marginTop: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
            <AlertTriangle size={18} />
            SECURITY TRIGGERED
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
            Your action was blocked. <br/>
            <strong>Your risk rating has been increased by +10.</strong>
          </p>
          {errorMessage && (
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
              Reason: {errorMessage}
            </p>
          )}
        </div>
        
        <button 
          onClick={() => setIsOpen(false)}
          style={{
            marginTop: '16px', width: '100%', padding: '12px',
            background: 'var(--danger)', color: 'white', border: 'none',
            borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--danger)'}
        >
          Acknowledge Warning
        </button>
      </div>
    </div>
  )
}
