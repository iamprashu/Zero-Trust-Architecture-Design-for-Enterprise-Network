import { useState, useEffect } from 'react'
import axios from 'axios'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardLayout from './pages/DashboardLayout'
import Overview from './pages/views/Overview'
import Transactions from './pages/views/Transactions'
import CreateAccount from './pages/views/CreateAccount'
import Loans from './pages/views/Loans'
import RestrictedModal from './components/RestrictedModal'
import { initializeSessionKey } from './utils/api'
import { clearSessionKey } from './utils/crypto'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || ''

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Listen for session-expired events (page refresh kills the session key)
  useEffect(() => {
    const handler = () => {
      clearSessionKey()
      localStorage.removeItem('accessToken')
      localStorage.removeItem('userInfo')
      setIsAuthenticated(false)
      setUserInfo(null)
      navigate('/login')
    }
    window.addEventListener('session-expired', handler)
    return () => window.removeEventListener('session-expired', handler)
  }, [navigate])

  useEffect(() => {
    const handleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')

      if (code) {
        try {
          const res = await axios.post(`${AUTH_URL}/api/auth/token`, { code })
          const data = res.data;
          
          if (data && data.accessToken) {
            localStorage.setItem('accessToken', data.accessToken)
            
            // Decode payload
            const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
            const user = { role: payload.role, userId: payload.userId }
            localStorage.setItem('userInfo', JSON.stringify(user))
            
            setUserInfo(user)
            setIsAuthenticated(true)
            
            // Initialize session key — generates ECDSA key pair and registers public key
            try {
              await initializeSessionKey()
              console.log('Session key initialized — all requests will be cryptographically signed')
            } catch (e) {
              console.error('Failed to initialize session key:', e)
            }
            
            // Clear URL
            window.history.replaceState({}, document.title, "/")
            navigate('/')
          } else {
            console.error('Token exchange failed:', data.error)
          }
        } catch(e) {
          console.error(e)
        }
      } else {
        const token = localStorage.getItem('accessToken')
        if (token) {
          // Page was refreshed — session key is gone, must re-auth
          // We can try to re-init the session key if the token is still valid
          try {
            await initializeSessionKey()
            setIsAuthenticated(true)
            const storedUser = localStorage.getItem('userInfo')
            if (storedUser) setUserInfo(JSON.parse(storedUser))
          } catch(e) {
            // Token expired or invalid — force re-login
            localStorage.removeItem('accessToken')
            localStorage.removeItem('userInfo')
          }
        }
      }
      setIsLoading(false)
    }

    handleAuth()
  }, [navigate])

  if (isLoading) {
    return <div className="animate-fade-in" style={{ display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Loading...</div>
  }

  return (
    <>
      <RestrictedModal />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" /> : <Login />
        } />
        
        <Route path="/" element={
          isAuthenticated ? <DashboardLayout userInfo={userInfo} /> : <Navigate to="/login" />
        }>
          <Route index element={<Overview />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="create-account" element={<CreateAccount />} />
          <Route path="loans" element={<Loans />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
