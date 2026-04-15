import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        System Control Panel
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '99px' }}>
          <User size={16} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
            {user?.role?.toUpperCase() || 'SUPERADMIN'}
          </span>
        </div>
        <button 
          onClick={logout}
          className="btn btn-secondary" 
          style={{ padding: '0.5rem 0.75rem' }}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
