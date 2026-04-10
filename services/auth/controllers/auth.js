const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('@repo/db');

// JWT Secrets should come from environment variables in production
const getJwtSecret = () => process.env.JWT_SECRET || 'default_secret';
const getRefreshSecret = () => process.env.REFRESH_SECRET || 'default_refresh_secret';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.disabled || user.deleted) {
      return res.status(403).json({ error: 'Account disabled or deleted' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Access token valid for 15 minutes
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.NODE_ENV == 'production' ? '7d' : '7d' }
    );

    // Refresh token valid for longer
    const refreshToken = jwt.sign(
      { userId: user._id },
      getRefreshSecret(),
      { expiresIn: '7d' }
    );

    // Save audit log
    await AuditLog.create({
      userId: user._id,
      action: 'login'
    });

    // Set cookies flag (HttpOnly secures tokens from XSS)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 mins
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.verifyAccess = async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ authorised: false, error: 'Endpoint is required' });
  }

  try {
    let token;
    let decoded;
    const secret = getJwtSecret();

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      try {
        decoded = jwt.verify(token, secret);
      } catch (err) {
        if (req.cookies && req.cookies.accessToken) {
          token = req.cookies.accessToken;
          decoded = jwt.verify(token, secret);
        } else {
          throw err;
        }
      }
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
      decoded = jwt.verify(token, secret);
    }

    if (!token || !decoded) {
      return res.status(401).json({ authorised: false, error: 'Missing or invalid token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ authorised: false, error: 'User not found' });
    }

    if (user.disabled || user.deleted) {
      return res.status(403).json({ authorised: false, error: 'User disabled or deleted' });
    }

    if (user.role === 'superadmin') {
      return res.json({ authorised: true });
    }

    const roleData = await require('@repo/db').Role.findOne({ name: user.role });
    const userPermissions = roleData ? roleData.permissions : [];

    if (userPermissions.includes('Z_ALL')) {
      return res.json({ authorised: true });
    }

    const mapping = await require('@repo/db').ApiMapping.findOne({ route: endpoint });
    if (!mapping) {
      return res.status(403).json({ authorised: false, error: `No permission mapping found for ${endpoint}. Access Denied.` });
    }

    if (mapping.requiredPermissions.length === 0) {
      return res.json({ authorised: true });
    }

    const hasPermissions = mapping.requiredPermissions.every(rp => userPermissions.includes(rp));
    if (!hasPermissions) {
      return res.status(403).json({ authorised: false, error: 'Insufficient permissions' });
    }

    return res.json({ authorised: true });
  } catch (error) {
    console.error('Verify Access Error:', error.message);
    return res.status(401).json({ authorised: false, error: `Token error: ${error.message}` });
  }
};

exports.logout = async (req, res) => {
  try {
    // req.user is set by verifyJwt middleware
    const userId = req.user.userId;

    // Save audit log
    await AuditLog.create({
      userId: userId,
      action: 'logout'
    });

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
