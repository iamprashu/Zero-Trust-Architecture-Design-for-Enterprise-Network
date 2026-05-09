import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { generateSessionKeyPair } from '../utils/crypto';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AUTH_URL = import.meta.env.VITE_AUTH_URL || '';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle SSO code exchange on mount
  useEffect(() => {
    const handleCodeExchange = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        try {
          const res = await axios.post(`${AUTH_URL}/api/auth/token`, { code });
          const data = res.data;
          if (data && data.accessToken) {
            setToken(data.accessToken);
            localStorage.setItem('adminToken', data.accessToken);

            // Initialize session key for per-request signing
            const publicKeyJWK = await generateSessionKeyPair();
            await axios.post(`${AUTH_URL}/api/auth/session-key`, { publicKeyJWK }, {
              headers: { Authorization: `Bearer ${data.accessToken}` },
              withCredentials: true
            });
            console.log('Admin session key initialized');

            // Clear URL
            window.history.replaceState({}, document.title, '/admin');
          }
        } catch (e) {
          console.error('Admin code exchange failed:', e);
        }
      }

      // Parse token
      const storedToken = localStorage.getItem('adminToken');
      if (storedToken) {
        try {
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          setUser({ userId: payload.userId, role: payload.role });

          // Re-init session key on page refresh
          const publicKeyJWK = await generateSessionKeyPair();
          await axios.post(`${AUTH_URL}/api/auth/session-key`, { publicKeyJWK }, {
            headers: { Authorization: `Bearer ${storedToken}` },
            withCredentials: true
          });
        } catch (e) {
          setToken(null);
          localStorage.removeItem('adminToken');
        }
      }

      setLoading(false);
    };

    handleCodeExchange();
  }, []);

  // Listen for session expiry events
  useEffect(() => {
    const handler = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, []);

  // Update user when token changes
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ userId: payload.userId, role: payload.role });
      } catch {
        setToken(null);
        localStorage.removeItem('adminToken');
      }
    }
  }, [token]);

  const login = (newToken) => {
    setToken(newToken);
    localStorage.setItem('adminToken', newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('adminToken');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
