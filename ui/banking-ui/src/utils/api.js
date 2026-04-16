const BANKING_URL = 'http://localhost:5001/api'

export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('accessToken')
  
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  
  const res = await fetch(`${BANKING_URL}${endpoint}`, options)
  const data = await res.json()
  
  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
    } else if (res.status === 403) {
      const event = new CustomEvent('restricted-access', { detail: data.error || 'Unauthorized access' })
      window.dispatchEvent(event)
    }
    throw new Error(data.error || 'Unauthorized access')
  }
  
  if (!res.ok) {
    throw new Error(data.error || 'API Error')
  }
  
  return data
}
