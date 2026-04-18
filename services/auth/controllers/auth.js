const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, AuditLog, Role, Permission, AuthCode, RefreshToken } = require("@repo/db");
const crypto = require("crypto");
const { encrypt, decrypt } = require("../utils/encryption");
// JWT Secrets should come from environment variables in production
const getJwtSecret = () => process.env.JWT_SECRET || "default_secret";
const getRefreshSecret = () =>
  process.env.REFRESH_SECRET || "default_refresh_secret";

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.disabled || user.deleted) {
      return res.status(403).json({ error: "Account disabled or deleted" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Access token valid for 15 minutes
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.NODE_ENV == "production" ? "7d" : "7d" },
    );

    // Refresh token valid for longer
    const refreshToken = jwt.sign({ userId: user._id }, getRefreshSecret(), {
      expiresIn: "7d",
    });

    user.refreshToken = encrypt(refreshToken);
    await user.save();

    // Save audit log
    await AuditLog.create({
      userId: user._id,
      action: "login",
    });

    // Set cookies flag (HttpOnly secures tokens from XSS)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Login successful",
      accessToken,
      // refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verifyAccess = async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res
      .status(400)
      .json({ authorised: false, error: "Endpoint is required" });
  }

  try {
    let token;
    let decoded;
    const secret = getJwtSecret();

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
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
      return res
        .status(401)
        .json({ authorised: false, error: "Missing or invalid token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res
        .status(401)
        .json({ authorised: false, error: "User not found" });
    }

    if (user.disabled || user.deleted) {
      return res
        .status(403)
        .json({ authorised: false, error: "User disabled or deleted" });
    }

    if (user.role === "superadmin") {
      return res.json({ authorised: true });
    }

    const roleData = await require("@repo/db").Role.findOne({
      name: user.role,
    });
    const userPermissions = roleData ? roleData.permissions : [];

    if (userPermissions.includes("Z_ALL")) {
      return res.json({ authorised: true });
    }

    const mapping = await require("@repo/db").ApiMapping.findOne({
      route: endpoint,
    });
    if (!mapping) {
      return res.status(403).json({
        authorised: false,
        error: `No permission mapping found for ${endpoint}. Access Denied.`,
      });
    }

    if (mapping.requiredPermissions.length === 0) {
      return res.json({ authorised: true });
    }

    const hasPermissions = mapping.requiredPermissions.every((rp) =>
      userPermissions.includes(rp),
    );
    if (!hasPermissions) {
      return res
        .status(403)
        .json({ authorised: false, error: "Insufficient permissions" });
    }

    return res.json({ authorised: true });
  } catch (error) {
    console.error("Verify Access Error:", error.message);
    return res
      .status(401)
      .json({ authorised: false, error: `Token error: ${error.message}` });
  }
};

exports.logout = async (req, res) => {
  try {
    // req.user is set by verifyJwt middleware
    const userId = req.user.userId;

    // Save audit log
    await AuditLog.create({
      userId: userId,
      action: "logout",
    });

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// OAuth2 Style Flow functions
exports.renderLogin = (req, res) => {
  const { redirect_uri } = req.query;
  if (!redirect_uri) {
    return res.status(400).send("Missing redirect_uri");
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Login - Auth Service</title>
      <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
        h2 { margin-top: 0; text-align: center; }
        input { width: 100%; padding: 0.75rem; margin: 0.5rem 0 1rem; box-sizing: border-box; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: white; }
        button { width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        button:hover { background: #2563eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Secure Login</h2>
        <form action="/api/auth/authorize" method="POST">
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <div style="text-align: left;"><label>Email</label></div>
          <input type="email" name="email" required />
          <div style="text-align: left;"><label>Password</label></div>
          <input type="password" name="password" required />
          <button type="submit">Sign In</button>
        </form>
      </div>
    </body>
    </html>
  `;
  res.send(html);
};

exports.authorize = async (req, res) => {
  try {
    const { email, password, redirect_uri } = req.body;

    if (!email || !password || !redirect_uri) {
      return res.status(400).json({ error: "Email, password, and redirect_uri are required" });
    }

    const user = await User.findOne({ email });
    if (!user || user.isBlocked || user.disabled || user.deleted) {
      return res.status(401).json({ error: "Invalid credentials or account blocked" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate Auth Code
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry

    await AuthCode.create({
      code,
      userId: user._id,
      redirectUri: redirect_uri,
      expiresAt
    });

    await AuditLog.create({
      userId: user._id,
      action: "oauth_authorize",
    });

    return res.redirect(`${redirect_uri}?code=${code}`);
  } catch (error) {
    console.error("Authorize error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.token = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const authCode = await AuthCode.findOne({ code });
    if (!authCode || authCode.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired authorization code" });
    }

    const user = await User.findById(authCode.userId);
    if (!user || user.isBlocked || user.disabled || user.deleted) {
      return res.status(401).json({ error: "User invalid or blocked" });
    }

    // Remove code so it cannot be reused
    await AuthCode.deleteOne({ _id: authCode._id });

    // Generate Tokens
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: "15m" }
    );

    const refreshTokenPlain = jwt.sign({ userId: user._id }, getRefreshSecret(), {
      expiresIn: "7d",
    });

    user.refreshToken = encrypt(refreshTokenPlain);
    await user.save();

    // Set Refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
      path: "/"
    });

    return res.json({
      accessToken,
      token_type: "Bearer",
      expires_in: 900 // 15 mins
    });

  } catch (error) {
    console.error("Token exchange error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    console.log("Refresh Done refresh token was:", refreshToken);
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, getRefreshSecret());
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired refresh token please login again" });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.isBlocked || user.disabled || user.deleted) {
      return res.status(401).json({ error: "User invalid or blocked" });
    }

    if (!user.refreshToken) {
      return res.status(401).json({ error: "No refresh token found for user" });
    }

    const decryptedToken = decrypt(user.refreshToken);
    if (decryptedToken !== refreshToken) {
      // Token mismatch could imply a re-use of an old token or theft
      user.refreshToken = null;
      await user.save();
      return res.status(401).json({ error: "Refresh token mismatch. Access revoked." });
    }

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: "15m" }
    );

    console.log("Refresh Done new access token is :", accessToken);

    // Keep original expiration time using the old token's exp claim
    const newRefreshToken = jwt.sign(
      { userId: user._id, exp: decoded.exp },
      getRefreshSecret()
    );

    console.log("Refresh Done new refresh token is :", newRefreshToken);

    user.refreshToken = encrypt(newRefreshToken);
    await user.save();


    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // the cookie should last until the remaining days, but maxAge handles it mostly well.
      // We will set to 7 days, but token exp controls exact second.
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      path: "/"
    });

    return res.json({
      message: "Token refreshed successfully",
      accessToken,
      token_type: "Bearer",
      expires_in: 900
    });

  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verify = async (req, res) => {
  try {
    const { token, requiredPermissions } = req.body;

    if (!token) {
      return res.status(400).json({ authorized: false, error: "Token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err) {
      return res.status(401).json({ authorized: false, error: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ authorized: false, error: "User not found" });
    }

    if (user.isBlocked || user.disabled || user.deleted) {
      return res.status(403).json({ authorized: false, error: "User is blocked or disabled" });
    }

    if (user.role === "superadmin") {
      return res.json({
        authorized: true,
        user: { userId: user._id, role: user.role }
      });
    }

    const roleData = await Role.findOne({ name: user.role });
    const userPerms = roleData ? roleData.permissions : [];

    if (userPerms.includes("Z_ALL")) {
      return res.json({ authorized: true, user: { userId: user._id, role: user.role } });
    }

    if (requiredPermissions && Array.isArray(requiredPermissions) && requiredPermissions.length > 0) {
      const hasAccess = requiredPermissions.every(rp => userPerms.includes(rp));

      if (!hasAccess) {
        user.riskScore += 10;
        if (user.riskScore > 90) {
          user.isBlocked = true;
        }
        await user.save();

        let message = "Insufficient permissions.";
        if (user.isBlocked) {
          message = "You are blocked due to repeated failed attempts. Please contact admin.";
        }

        return res.status(403).json({ authorized: false, error: message });
      }
    }

    return res.json({
      authorized: true,
      user: { userId: user._id, role: user.role }
    });

  } catch (error) {
    console.error("Centralized Verify error:", error);
    res.status(500).json({ authorized: false, error: "Internal server error" });
  }
};
