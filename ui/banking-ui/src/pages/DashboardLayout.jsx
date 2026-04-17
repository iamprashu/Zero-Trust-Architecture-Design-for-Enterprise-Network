import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, UserPlus, Banknote, LogOut } from 'lucide-react'

export default function DashboardLayout({ userInfo }) {
  const location = useLocation()
  
  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('userInfo')
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }} className="animate-fade-in">
      
      {/* Sidebar */}
      <aside style={{ width: '250px', background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', fontSize: '1.25rem', fontWeight: '800', color: 'white', background: 'linear-gradient(to right, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          NEXUS BANK
        </div>
        
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            <LayoutDashboard size={20} /> Accounts List
          </Link>
          <Link to="/transactions" className={`nav-link ${location.pathname === '/transactions' ? 'active' : ''}`}>
            <ArrowLeftRight size={20} /> New Transaction
          </Link>
          <Link to="/create-account" className={`nav-link ${location.pathname === '/create-account' ? 'active' : ''}`}>
            <UserPlus size={20} /> Create Account
          </Link>
          <Link to="/loans" className={`nav-link ${location.pathname === '/loans' ? 'active' : ''}`}>
            <Banknote size={20} /> Loans
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <header style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.4)' }}>
          <h2 style={{ margin: 0, fontWeight: 600 }}>Overview</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ 
              background: 'rgba(139, 92, 246, 0.15)', color: 'var(--primary)', 
              padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', 
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' 
            }}>
              {userInfo?.role || 'Guest'} Shield
            </span>
            <button onClick={handleLogout} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        <div style={{ padding: '32px', flex: 1 }}>
          <Outlet />
        </div>
      </main>

    </div>
  )
}
