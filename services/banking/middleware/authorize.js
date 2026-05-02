const authVerificationUrl = process.env.AUTH_VERIFY_URL || 'http://localhost:5000/api/auth/verify';

exports.authorize = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const deviceId = req.headers['x-device-id'];

      // Call Centralized Auth Service
      const response = await fetch(authVerificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, requiredPermissions, deviceId })
      });

      const data = await response.json();

      if (!response.ok || !data.authorized) {
        return res.status(v(response.status, 403)).json({ error: data.error || 'Unauthorized', code: data.code, isFirstLogin: data.isFirstLogin });
      }

      // Populate req.user just in case it is needed by downstream handlers
      req.user = data.user;
      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      return res.status(500).json({ error: 'Internal server error verifying authorization' });
    }
  };
};

function v(status, fallback) {
  return (status >= 400 && status < 600) ? status : fallback;
}
