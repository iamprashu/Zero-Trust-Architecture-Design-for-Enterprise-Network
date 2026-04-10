const jwt = require('jsonwebtoken');
const { User, Role, ApiMapping } = require('@repo/db');

const getJwtSecret = () => process.env.JWT_SECRET || 'default_secret';

// Verify JWT token in the Authorization header or cookies
exports.verifyJwt = (req, res, next) => {
  try {
    let token;
    let decoded;

    const secret = getJwtSecret();

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      try {
        decoded = jwt.verify(token, secret);
      } catch (err) {
        // If header token is stale/invalid, try cookie fallback (common Postman issue)
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
    } else {
      return res.status(401).json({ error: 'Missing token' });
    }

    // Attach decoded user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ error: `Token expired or invalid: ${error.message}` });
  }
};


// General RBAC Guard based on ApiMapping
// We assume it's used after verifyJwt
exports.rbacGuard = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    let userPermissions = [];
    if (user.role === 'superadmin') {
      userPermissions = ['Z_ALL']; // Inherit bypass directly
    } else {
      const roleData = await Role.findOne({ name: user.role });
      if (roleData) {
        userPermissions = roleData.permissions;
      }
    }

    // superadmin with Z_ALL skips RBAC
    if (userPermissions.includes('Z_ALL')) {
      return next();
    }

    // Map req.originalUrl or req.path to the database
    // For exact match:
    const routePath = req.baseUrl + req.route.path; // e.g. /api/admin/users/disable

    const mapping = await ApiMapping.findOne({ route: routePath });
    if (!mapping) {
      // If no mapping defined, we can either default deny or default allow.
      // A zero-trust model usually defaults to default-deny unless specified.
      return res.status(403).json({ error: `No permission mapping found for ${routePath}. Access Denied.` });
    }

    // If there are no required permissions configured, it might be open to any authenticated user
    if (mapping.requiredPermissions.length === 0) {
      return next();
    }

    // Check if user has ALL required permissions (or SOME, depending on policy, let's say ALL)
    const hasPermissions = mapping.requiredPermissions.every(rp => userPermissions.includes(rp));

    if (!hasPermissions) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Strict Superadmin Check
exports.superAdminGuard = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ error: 'Superadmin privileges required' });
};
