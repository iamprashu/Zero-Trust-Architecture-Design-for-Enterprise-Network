import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceOtpModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('prompt'); // 'prompt' -> 'otp'
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const handleDeviceUnrecognized = (event) => {
      setIsOpen(true);
      setStep('prompt');
      setError('');
      setIsFirstLogin(event.detail?.isFirstLogin || false);
      
      const storedDeviceId = localStorage.getItem('deviceId');
      setDeviceId(storedDeviceId || '');
      
      // Try to get userId from token or local storage
      const userStr = localStorage.getItem('user') || localStorage.getItem('userInfo');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          setUserId(userObj.id || userObj._id || userObj.userId || '');
        } catch (e) {}
      }
    };

    window.addEventListener('device_unrecognized', handleDeviceUnrecognized);
    return () => window.removeEventListener('device_unrecognized', handleDeviceUnrecognized);
  }, []);

  if (!isOpen) return null;

  const handleRequestOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${import.meta.env.VITE_DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices/otp/request`, {
        userId,
        deviceId,
        deviceName: navigator.userAgent
      });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${import.meta.env.VITE_DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices/otp/verify`, {
        userId,
        deviceId,
        otp
      });
      setIsOpen(false);
      window.location.reload(); // Reload to retry failed requests
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#1e293b', padding: '2rem', borderRadius: '8px',
        maxWidth: '400px', width: '100%', color: 'white', textAlign: 'center'
      }}>
        <h2 style={{marginTop: 0}}>Unrecognized Device</h2>
        {error && <p style={{color: '#ef4444', marginBottom: '1rem'}}>{error}</p>}
        
        {step === 'prompt' ? (
          <div>
            <p style={{marginBottom: '1.5rem'}}>
              {isFirstLogin 
                ? "This is your first time logging in. We need to verify this device."
                : "You are logging in from an unrecognized device or browser. Do you have a new device?"}
            </p>
            <button 
              onClick={handleRequestOtp} 
              disabled={loading}
              style={{
                width: '100%', padding: '0.75rem', background: '#3b82f6', 
                color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
              }}
            >
              {loading ? 'Sending...' : 'Yes, Send OTP'}
            </button>
            <button 
              onClick={() => {
                setIsOpen(false);
                localStorage.removeItem('token');
                localStorage.removeItem('adminToken');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                localStorage.removeItem('userInfo');
                window.location.href = '/login';
              }} 
              style={{
                width: '100%', padding: '0.75rem', background: 'transparent', 
                color: '#94a3b8', border: '1px solid #475569', borderRadius: '4px', 
                cursor: 'pointer', marginTop: '0.5rem'
              }}
            >
              Cancel & Logout
            </button>
          </div>
        ) : (
          <div>
            <p style={{marginBottom: '1.5rem'}}>An OTP has been sent to your email. It is valid for 10 minutes.</p>
            <input 
              type="text" 
              placeholder="Enter 6-digit OTP" 
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem', marginBottom: '1rem',
                borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box'
              }}
            />
            <button 
              onClick={handleVerifyOtp} 
              disabled={loading || !otp}
              style={{
                width: '100%', padding: '0.75rem', background: '#10b981', 
                color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
              }}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceOtpModal;
