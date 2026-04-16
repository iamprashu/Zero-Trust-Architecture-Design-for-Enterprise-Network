import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import DashboardLayout from './pages/DashboardLayout'
import Overview from './pages/views/Overview'
import Transactions from './pages/views/Transactions'
import Transfer from './pages/views/Transfer'
import CreateAccount from './pages/views/CreateAccount'
import RestrictedModal from './components/RestrictedModal'

const AUTH_URL = 'http://localhost:5000'
const REDIRECT_URI = 'http://localhost:5002' 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')

      if (code) {
        try {
          const res = await fetch(`${AUTH_URL}/api/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          })
          const data = await res.json()
          
          if (res.ok) {
            localStorage.setItem('accessToken', data.accessToken)
            
            // Decode simple payload
            const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
            const user = { role: payload.role, userId: payload.userId }
            localStorage.setItem('userInfo', JSON.stringify(user))
            
            setUserInfo(user)
            setIsAuthenticated(true)
            
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
          setIsAuthenticated(true)
          const storedUser = localStorage.getItem('userInfo')
          if (storedUser) setUserInfo(JSON.parse(storedUser))
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
          <Route path="transfer" element={<Transfer />} />
          <Route path="create-account" element={<CreateAccount />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
