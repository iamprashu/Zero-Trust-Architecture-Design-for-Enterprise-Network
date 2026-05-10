const crypto = require('crypto');

const authVerificationUrl = process.env.AUTH_VERIFY_URL || 'http://localhost:5000/api/auth/verify';

exports.authorize = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];

      // Extract signature headers for cryptographic request verification
      const signature = req.headers['x-signature'];
      const timestamp = req.headers['x-timestamp'];

      // Compute body hash for signature verification
      // Match frontend: empty/no body → hash of '', otherwise hash of JSON.stringify(body)
      const hasBody = req.body && Object.keys(req.body).length > 0;
      const bodyStr = hasBody ? JSON.stringify(req.body) : '';
      const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

      // Build verification payload
      const verifyBody = {
        token,
        requiredPermissions,
        signature: signature || undefined,
        timestamp: timestamp || undefined,
        method: req.method,
        url: req.originalUrl || req.url,
        bodyHash,
        // Forward User-Agent so auth service can compare against stored OTP device fingerprint
        userAgent: req.headers['user-agent'] || '',
        // Forward deviceId cookie/header for OTP session path
        deviceId: req.headers['x-device-id'] || req.cookies?.deviceId || undefined
      };

      // Call Centralized Auth Service
      const response = await fetch(authVerificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyBody)
      });

      const data = await response.json();

      if (!response.ok || !data.authorized) {
        const status = (response.status >= 400 && response.status < 600) ? response.status : 403;
        return res.status(status).json({
          error: data.error || 'Unauthorized',
          code: data.code,
          isFirstLogin: data.isFirstLogin
        });
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
