import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Key, ScrollText } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Users', path: '/users', icon: <Users size={20} /> },
    { name: 'Roles', path: '/roles', icon: <Shield size={20} /> },
    { name: 'Permissions', path: '/permissions', icon: <Key size={20} /> },
    { name: 'Audit Logs', path: '/logs', icon: <ScrollText size={20} /> },
  ];

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 1rem'
    }}>
      <div style={{ padding: '0 0.5rem', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--primary)', letterSpacing: '1px', fontWeight: 800 }}>ZTA ADMIN</h2>
      </div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map(item => (
          <NavLink
            key={item.name}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: isActive ? 'white' : 'var(--text-muted)',
              background: isActive ? 'var(--primary)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              transition: 'background 0.2s'
            })}
            className={({ isActive }) => !isActive ? 'hover-nav' : ''}
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
      
      <style>{`
        .hover-nav:hover { background: rgba(255,255,255,0.05) !important; color: white !important; }
      `}</style>
    </aside>
  );
};

export default Sidebar;
