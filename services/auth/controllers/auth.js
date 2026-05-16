const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, AuditLog, Role, Permission, AuthCode, RefreshToken, Device, SessionKey } = require("@repo/db");
const crypto = require("crypto");
const qrcode = require("qrcode");
const { authenticator } = require("otplib");
const { encrypt, decrypt } = require("../utils/encryption");
// JWT Secrets should come from environment variables in production
const getJwtSecret = () => process.env.JWT_SECRET || "default_secret";
const getRefreshSecret = () =>
  process.env.REFRESH_SECRET || "default_refresh_secret";

// ── Security Helpers ──────────────────────────────────────────────────────────

/**
 * Compute a salted SHA-256 hash of the User-Agent string.
 * Used to bind OTP temp-device sessions to the browser/machine that created them.
 * The salt prevents pre-computation attacks.
 */
const FINGERPRINT_SALT = process.env.FINGERPRINT_SALT || 'zt_fp_default_salt_change_in_prod';
function computeFingerprint(userAgent) {
  return crypto
    .createHash('sha256')
    .update(FINGERPRINT_SALT + (userAgent || ''))
    .digest('hex');
}

/**
 * Nuclear option: revoke ALL sessions for a user and set security lockout.
 * Called after 3 consecutive OTP device fingerprint mismatches.
 * NOTE: authenticatorSecret and isAuthenticatorSetup are NEVER touched here.
 * The user's TOTP app on their phone remains valid for use after admin unlock.
 */
async function revokeAllAndLockout(user) {
  user.refreshToken = null;
  user.securityLockout = true;
  user.securityIncidentCount = 0; // reset counter — lockout flag is now the gate
  await user.save();
  // Kill all active TPM sessions (ephemeral keys)
  await SessionKey.deleteMany({ userId: user._id });
  // Kill all OTP device sessions
  await Device.deleteMany({ userId: user._id });
  // Log the incident for admin audit trail
  await AuditLog.create({ userId: user._id, action: 'security_incident' });
}

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

const renderError = (res, message) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Error - Auth Service</title>
      <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; border-top: 4px solid #ef4444; }
        h2 { margin-top: 0; color: #ef4444; }
        a { color: #3b82f6; text-decoration: none; display: inline-block; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Authentication Error</h2>
        <p>${message}</p>
        <a href="javascript:history.back()">Go Back</a>
      </div>
    </body>
    </html>
  `);
};

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
    const { email, password, redirect_uri, deviceId } = req.body;
    const isNewDevice = req.body.new_device === 'true' || req.query.new_device === 'true';

    if (!email || !password || !redirect_uri) {
      return renderError(res, "Email, password, and redirect_uri are required.");
    }

    const user = await User.findOne({ email });
    if (!user) {
      return renderError(res, "Invalid credentials or account blocked/disabled.");
    }

    // Check blocked/disabled/deleted status
    if (user.isBlocked || user.disabled || user.deleted) {
      return renderError(res, "Invalid credentials or account blocked/disabled.");
    }

    // Check security lockout — blocked before any further processing
    if (user.securityLockout) {
      return renderError(
        res,
        'Your account has been security-locked due to suspicious activity detected on your session. ' +
        'This protects your account from unauthorized access. ' +
        'Please contact your system administrator to unlock your account before logging in again.'
      );
    }


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return renderError(res, "Invalid credentials.");
    }

    // TOTP Authenticator setup (first time ever for ANY user including superadmin)
    if (!user.isAuthenticatorSetup) {
      const secret = authenticator.generateSecret();
      user.authenticatorSecret = secret;
      await user.save();

      const otpauth = authenticator.keyuri(user.email, 'ZeroTrustBank', secret);
      const qrCodeUrl = await qrcode.toDataURL(otpauth);

      const setupHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Setup Authenticator</title>
          <style>
            body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
            img { border-radius: 8px; margin: 1rem 0; background: white; padding: 10px; }
            input { width: 100%; padding: 0.75rem; margin: 0.5rem 0 1rem; box-sizing: border-box; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: white; text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; }
            button { width: 100%; padding: 0.75rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Setup Authenticator</h2>
            <p>Scan the QR code with your authenticator app.</p>
            <img src="${qrCodeUrl}" alt="QR Code" />
            <form action="/api/auth/setup-authenticator" method="POST">
              <input type="hidden" name="userId" value="${user._id}" />
              <input type="text" name="token" required maxlength="6" placeholder="000000" autocomplete="off" />
              <button type="submit">Verify & Complete Setup</button>
            </form>
          </div>
        </body>
        </html>
      `;
      return res.send(setupHtml);
    }

    // Check if user has registered WebAuthn credentials
    const { WebAuthnCredential } = require("@repo/db");
    const hasWebAuthnCreds = await WebAuthnCredential.countDocuments({ userId: user._id });

    // If user has WebAuthn creds AND is not explicitly using new device flow → WebAuthn challenge
    if (hasWebAuthnCreds > 0 && !isNewDevice) {
      const webauthnLoginHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Device Verification</title>
          <style>
            body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 420px; text-align: center; }
            button { width: 100%; padding: 0.75rem; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; }
            .btn-primary { background: #3b82f6; }
            .btn-secondary { background: #334155; margin-top: 0.75rem; font-size: 0.875rem; }
            button:disabled { background: #64748b; cursor: not-allowed; }
            .status { margin: 1rem 0; padding: 0.75rem; border-radius: 4px; }
            .error { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Verify Your Device</h2>
            <p>Use your biometric or PIN to verify this is your registered device.</p>
            <div id="statusBox"></div>
            <button id="verifyBtn" class="btn-primary" onclick="startWebAuthn()">Verify with Biometric/PIN</button>
            <form action="/api/auth/authorize" method="POST">
              <input type="hidden" name="email" value="${email}" />
              <input type="hidden" name="password" value="${password}" />
              <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
              <input type="hidden" name="new_device" value="true" />
              <button type="submit" class="btn-secondary">Use different device (OTP)</button>
            </form>
          </div>
          <script>
            const userId = '${user._id}';
            const redirectUri = '${redirect_uri}';
            async function startWebAuthn() {
              const btn = document.getElementById('verifyBtn');
              const statusBox = document.getElementById('statusBox');
              btn.disabled = true;
              btn.innerText = 'Waiting for device...';
              statusBox.innerHTML = '';
              try {
                const optRes = await fetch('/api/auth/webauthn/login-options', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId })
                });
                const optData = await optRes.json();
                if (!optRes.ok) throw new Error(optData.error);
                const options = optData.options;
                options.challenge = base64urlToBuffer(options.challenge);
                if (options.allowCredentials) {
                  options.allowCredentials = options.allowCredentials.map(c => ({
                    ...c, id: base64urlToBuffer(c.id)
                  }));
                }
                const assertion = await navigator.credentials.get({ publicKey: options });
                const assertionResponse = {
                  id: assertion.id,
                  rawId: bufferToBase64url(assertion.rawId),
                  type: assertion.type,
                  response: {
                    clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
                    authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
                    signature: bufferToBase64url(assertion.response.signature),
                    userHandle: assertion.response.userHandle ? bufferToBase64url(assertion.response.userHandle) : null
                  },
                  clientExtensionResults: assertion.getClientExtensionResults()
                };
                const verRes = await fetch('/api/auth/webauthn/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ challengeToken: optData.challengeToken, assertionResponse, redirect_uri: redirectUri })
                });
                const verData = await verRes.json();
                if (!verRes.ok) throw new Error(verData.error);
                window.location.href = redirectUri + '?code=' + verData.code;
              } catch (err) {
                console.error(err);
                statusBox.innerHTML = '<div class="status error">' + (err.message || 'Verification failed. Try OTP instead.') + '</div>';
                btn.disabled = false;
                btn.innerText = 'Try Again';
              }
            }
            function base64urlToBuffer(b) { const s = b.replace(/-/g,'+').replace(/_/g,'/'); const p = s.length%4===0?'':'='.repeat(4-s.length%4); const bin = atob(s+p); const a = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a.buffer; }
            function bufferToBase64url(buf) { const a = new Uint8Array(buf); let b=''; for(let i=0;i<a.length;i++) b+=String.fromCharCode(a[i]); return btoa(b).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); }
          </script>
        </body>
        </html>
      `;
      return res.send(webauthnLoginHtml);
    }

    // No WebAuthn creds — user must either re-register device or use temp OTP session
    if (hasWebAuthnCreds === 0 && user.isAuthenticatorSetup && !isNewDevice) {
      const tempDeviceId = crypto.randomBytes(16).toString('hex');
      const reRegisterHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Device Required</title>
          <style>
            body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 440px; text-align: center; }
            button { width: 100%; padding: 0.75rem; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; }
            .btn-primary { background: #10b981; }
            .btn-secondary { background: #334155; margin-top: 0.75rem; font-size: 0.875rem; }
            button:disabled { background: #64748b; cursor: not-allowed; }
            .status { margin: 1rem 0; padding: 0.75rem; border-radius: 4px; }
            .error { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #ef4444; }
            .success { background: rgba(16,185,129,0.1); border: 1px solid #10b981; color: #10b981; }
            .info { background: rgba(59,130,246,0.1); border: 1px solid #3b82f6; color: #93c5fd; padding: 0.75rem; border-radius: 4px; margin-bottom: 1.5rem; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>No Device Registered</h2>
            <div class="info">Your device registration was revoked or not found. Please register this device or use a temporary session.</div>
            <div id="statusBox"></div>
            <button id="registerBtn" class="btn-primary" onclick="startRegistration()">Register This Device (Biometric/PIN)</button>
            <form action="/api/auth/authorize" method="POST">
              <input type="hidden" name="email" value="${email}" />
              <input type="hidden" name="password" value="${password}" />
              <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
              <input type="hidden" name="new_device" value="true" />
              <button type="submit" class="btn-secondary">Use Temporary Session (5hr OTP)</button>
            </form>
          </div>
          <script>
            const userId = '${user._id}';
            async function startRegistration() {
              const btn = document.getElementById('registerBtn');
              const statusBox = document.getElementById('statusBox');
              btn.disabled = true;
              btn.innerText = 'Waiting for device...';
              statusBox.innerHTML = '';
              try {
                const optRes = await fetch('/api/auth/webauthn/register-options', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId })
                });
                const optData = await optRes.json();
                if (!optRes.ok) throw new Error(optData.error);
                const options = optData.options;
                options.challenge = base64urlToBuffer(options.challenge);
                options.user.id = base64urlToBuffer(options.user.id);
                if (options.excludeCredentials) {
                  options.excludeCredentials = options.excludeCredentials.map(c => ({
                    ...c, id: base64urlToBuffer(c.id)
                  }));
                }
                const credential = await navigator.credentials.create({ publicKey: options });
                const attestationResponse = {
                  id: credential.id,
                  rawId: bufferToBase64url(credential.rawId),
                  type: credential.type,
                  response: {
                    clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                    attestationObject: bufferToBase64url(credential.response.attestationObject),
                    transports: credential.response.getTransports ? credential.response.getTransports() : ['internal']
                  },
                  clientExtensionResults: credential.getClientExtensionResults()
                };
                const verRes = await fetch('/api/auth/webauthn/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ challengeToken: optData.challengeToken, attestationResponse, deviceName: navigator.userAgent })
                });
                const verData = await verRes.json();
                if (!verRes.ok) throw new Error(verData.error);
                statusBox.innerHTML = '<div class="status success">Device registered! Please login again.</div>';
                setTimeout(() => { window.location.href = 'https://iamprashu.in'; }, 2000);
              } catch (err) {
                console.error(err);
                statusBox.innerHTML = '<div class="status error">' + (err.message || 'Registration failed') + '</div>';
                btn.disabled = false;
                btn.innerText = 'Try Again';
              }
            }
            function base64urlToBuffer(b) { const s = b.replace(/-/g,'+').replace(/_/g,'/'); const p = s.length%4===0?'':'='.repeat(4-s.length%4); const bin = atob(s+p); const a = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a.buffer; }
            function bufferToBase64url(buf) { const a = new Uint8Array(buf); let b=''; for(let i=0;i<a.length;i++) b+=String.fromCharCode(a[i]); return btoa(b).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); }
          </script>
        </body>
        </html>
      `;
      return res.send(reRegisterHtml);
    }

    // Explicit new device login (OTP fallback for temp 5hr session)
    if (isNewDevice) {
      const tempDeviceId = crypto.randomBytes(16).toString('hex');
      const verifyHtml = `
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Verify Device</title>
        <style>body{font-family:'Inter',sans-serif;background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.card{background:#1e293b;padding:2rem;border-radius:8px;width:100%;max-width:400px;text-align:center}input{width:100%;padding:0.75rem;margin:0.5rem 0 1rem;box-sizing:border-box;border-radius:4px;border:1px solid #334155;background:#0f172a;color:white;text-align:center;font-size:1.5rem;letter-spacing:0.5rem}button{width:100%;padding:0.75rem;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold}.fallback-btn{background:#334155;margin-top:1rem;font-size:0.875rem}</style>
        </head><body><div class="card"><h2>Verify New Device</h2><p>Enter the code from your authenticator app.</p>
        <form action="/api/auth/verify-device-totp" method="POST">
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="deviceId" value="${tempDeviceId}" />
          <input type="hidden" name="userId" value="${user._id}" />
          <input type="text" name="token" required maxlength="6" placeholder="000000" autocomplete="off" />
          <button type="submit">Verify Code</button>
        </form>
        <form action="/api/auth/fallback-otp" method="POST">
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="deviceId" value="${tempDeviceId}" />
          <input type="hidden" name="userId" value="${user._id}" />
          <button type="submit" class="fallback-btn">Use email OTP instead</button>
        </form></div></body></html>`;
      return res.send(verifyHtml);
    }

    // Generate Auth Code
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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
    renderError(res, "Internal server error.");
  }
};



exports.setupAuthenticator = async (req, res) => {
  try {
    const { userId, token } = req.body;
    const user = await User.findById(userId);
    if (!user) return renderError(res, "User not found.");

    const isValid = authenticator.verify({ token, secret: user.authenticatorSecret });
    if (!isValid) {
      return renderError(res, "Invalid authenticator code. Please try again.");
    }

    user.isAuthenticatorSetup = true;
    await user.save();

    // After TOTP setup, chain into WebAuthn device registration
    const webauthnRegHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Register Device</title>
        <style>
          body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 420px; text-align: center; }
          button { width: 100%; padding: 0.75rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; }
          button:disabled { background: #64748b; cursor: not-allowed; }
          .status { margin: 1rem 0; padding: 0.75rem; border-radius: 4px; }
          .error { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #ef4444; }
          .success { background: rgba(16,185,129,0.1); border: 1px solid #10b981; color: #10b981; }
          a { color: #3b82f6; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Register This Device</h2>
          <p>Authenticator verified! Now register this device with your biometric or PIN for future logins.</p>
          <div id="statusBox"></div>
          <button id="registerBtn" onclick="startRegistration()">Register Device (Biometric/PIN)</button>
          <div id="skipLink" style="margin-top: 1rem;">
            <a href="/">Skip & Login Later</a>
          </div>
        </div>
        <script>
          const userId = '${user._id}';
          async function startRegistration() {
            const btn = document.getElementById('registerBtn');
            const statusBox = document.getElementById('statusBox');
            btn.disabled = true;
            btn.innerText = 'Waiting for device...';
            statusBox.innerHTML = '';
            try {
              // 1. Get registration options
              const optRes = await fetch('/api/auth/webauthn/register-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
              });
              const optData = await optRes.json();
              if (!optRes.ok) throw new Error(optData.error);

              const options = optData.options;
              // Convert base64url to ArrayBuffer
              options.challenge = base64urlToBuffer(options.challenge);
              options.user.id = base64urlToBuffer(options.user.id);
              if (options.excludeCredentials) {
                options.excludeCredentials = options.excludeCredentials.map(c => ({
                  ...c, id: base64urlToBuffer(c.id)
                }));
              }

              // 2. Create credential via browser API
              const credential = await navigator.credentials.create({ publicKey: options });

              // 3. Send attestation to server
              const attestationResponse = {
                id: credential.id,
                rawId: bufferToBase64url(credential.rawId),
                type: credential.type,
                response: {
                  clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                  attestationObject: bufferToBase64url(credential.response.attestationObject),
                  transports: credential.response.getTransports ? credential.response.getTransports() : ['internal']
                },
                clientExtensionResults: credential.getClientExtensionResults()
              };

              const verRes = await fetch('/api/auth/webauthn/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  challengeToken: optData.challengeToken,
                  attestationResponse,
                  deviceName: navigator.userAgent
                })
              });
              const verData = await verRes.json();
              if (!verRes.ok) throw new Error(verData.error);

              statusBox.innerHTML = '<div class="status success">Device registered! Redirecting to login...</div>';
              document.getElementById('skipLink').innerHTML = '';
              setTimeout(() => { window.location.href = 'https://iamprashu.in'; }, 2000);
            } catch (err) {
              console.error(err);
              statusBox.innerHTML = '<div class="status error">' + (err.message || 'Registration failed') + '</div>';
              btn.disabled = false;
              btn.innerText = 'Try Again';
            }
          }
          function base64urlToBuffer(base64url) {
            const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
            const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
            const binary = atob(base64 + pad);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes.buffer;
          }
          function bufferToBase64url(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
          }
        </script>
      </body>
      </html>
    `;
    res.send(webauthnRegHtml);
  } catch (err) {
    console.error(err);
    renderError(res, "Internal server error.");
  }
};

exports.verifyDeviceTotp = async (req, res) => {
  try {
    const { userId, deviceId, token, redirect_uri } = req.body;
    const user = await User.findById(userId);
    if (!user) return renderError(res, "User not found.");

    if (user.securityLockout) {
      return renderError(res, 'Your account is security-locked. Contact your administrator.');
    }

    const isValid = authenticator.verify({ token, secret: user.authenticatorSecret });
    if (!isValid) {
      user.riskScore += 10;
      await user.save();
      return renderError(res, "Invalid authenticator code. Risk score increased.");
    }

    // Create 5-hour session device — bind fingerprint at creation time
    const device = new Device({
      userId,
      deviceId,
      deviceName: req.headers['user-agent'] || 'Unknown Device',
      isTrusted: false,
      expiresAt: new Date(Date.now() + 5 * 3600000), // 5 hours
      deviceFingerprint: computeFingerprint(req.headers['user-agent']), // bind UA at creation
    });
    await device.save();

    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await AuthCode.create({ code, userId, redirectUri: redirect_uri, expiresAt });
    await AuditLog.create({ userId, action: "oauth_authorize" });

    return res.redirect(`${redirect_uri}?code=${code}`);
  } catch (err) {
    console.error(err);
    renderError(res, "Internal server error.");
  }
};

exports.fallbackOtp = async (req, res) => {
  try {
    const { userId, deviceId, redirect_uri } = req.body;
    const axios = require('axios');

    try {
      await axios.post(`${process.env.DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices/otp/request`, {
        userId,
        deviceId,
        deviceName: req.headers['user-agent']
      });
    } catch (e) {
      console.error("Failed to request OTP during login", e.message);
      return renderError(res, "Failed to send OTP email. Please try again later.");
    }

    const otpHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Verify Device - OTP</title>
        <style>
          body { font-family: 'Inter', sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
          input { width: 100%; padding: 0.75rem; margin: 0.5rem 0 1rem; box-sizing: border-box; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: white; text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; }
          button { width: 100%; padding: 0.75rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Verify Device</h2>
          <p>We've sent a 6-digit OTP to your email.</p>
          <form action="/api/auth/authorize-otp" method="POST">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <input type="hidden" name="deviceId" value="${deviceId}" />
            <input type="hidden" name="userId" value="${userId}" />
            <input type="text" name="otp" required maxlength="6" placeholder="000000" autocomplete="off" />
            <button type="submit">Verify OTP</button>
          </form>
        </div>
      </body>
      </html>
    `;
    return res.send(otpHtml);
  } catch (err) {
    console.error(err);
    renderError(res, "Internal server error.");
  }
};

exports.authorizeOtp = async (req, res) => {
  try {
    const { userId, deviceId, otp, redirect_uri } = req.body;
    if (!userId || !deviceId || !otp || !redirect_uri) {
      return renderError(res, "Missing parameters for OTP verification.");
    }

    // Check security lockout before allowing OTP verification
    const user = await User.findById(userId);
    if (!user) return renderError(res, 'User not found.');
    if (user.securityLockout) {
      return renderError(res, 'Your account is security-locked. Contact your administrator.');
    }

    const axios = require('axios');
    try {
      await axios.post(`${process.env.DEVICE_SERVICE_URL || 'http://localhost:3005'}/api/devices/otp/verify`, {
        userId, deviceId, otp
      });
    } catch (e) {
      const user = await User.findById(userId);
      if (user) {
        user.riskScore += 10;
        await user.save();
      }
      return renderError(res, "Invalid or expired OTP. Risk score increased.");
    }

    // OTP verified — create the temp device record with fingerprint bound to this machine
    try {
      const existingDevice = await Device.findOne({ deviceId });
      if (!existingDevice) {
        await Device.create({
          userId,
          deviceId,
          deviceName: req.headers['user-agent'] || 'Unknown Device',
          isTrusted: false,
          expiresAt: new Date(Date.now() + 5 * 3600000), // 5 hours
          deviceFingerprint: computeFingerprint(req.headers['user-agent']), // bind UA
        });
      }
    } catch (devErr) {
      console.error('Failed to create device record after OTP verify:', devErr.message);
    }

    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await AuthCode.create({ code, userId, redirectUri: redirect_uri, expiresAt });
    await AuditLog.create({ userId, action: "oauth_authorize" });

    return res.redirect(`${redirect_uri}?code=${code}`);
  } catch (error) {
    console.error("Authorize OTP error:", error);
    renderError(res, "Internal server error.");
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

    // Determine if this is an OTP/temp session by checking for a live Device record
    // OTP sessions get sessionType + sessionExpiry embedded in the JWT for server-side cap enforcement
    const otpDevice = await Device.findOne({
      userId: user._id,
      isTrusted: false,
      expiresAt: { $gt: new Date() }
    });

    // Build JWT payload — embed OTP session metadata if applicable
    const tokenPayload = { userId: user._id, role: user.role };
    if (otpDevice) {
      tokenPayload.sessionType = 'otp';                          // signals OTP path to all verifiers
      tokenPayload.sessionExpiry = otpDevice.expiresAt.getTime(); // hard 5hr cap enforced in verify
      tokenPayload.deviceId = otpDevice.deviceId;                // ties JWT to the specific device record
    }

    // Generate Tokens
    const accessToken = jwt.sign(
      tokenPayload,
      getJwtSecret(),
      { expiresIn: otpDevice ? '5h' : '15m' } // OTP sessions get a 5hr access token
    );

    const refreshTokenPlain = jwt.sign({ userId: user._id }, getRefreshSecret(), {
      expiresIn: otpDevice ? '5h' : '7d', // OTP sessions get no long-lived refresh token
    });

    user.refreshToken = encrypt(refreshTokenPlain);
    await user.save();

    // Set Refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: otpDevice
        ? 5 * 60 * 60 * 1000          // 5 hours for OTP sessions
        : 7 * 24 * 60 * 60 * 1000,   // 7 days for TPM sessions
      sameSite: "lax",
      path: "/"
    });

    return res.json({
      accessToken,
      token_type: "Bearer",
      expires_in: otpDevice ? 18000 : 900 // 5hr (18000s) or 15min (900s)
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

    // Security lockout check — locked users cannot refresh tokens
    if (user.securityLockout) {
      res.clearCookie('refreshToken');
      res.clearCookie('accessToken');
      return res.status(403).json({
        error: 'Account security-locked. Contact your administrator.',
        code: 'SECURITY_LOCKOUT'
      });
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

    // Check if this is an OTP session by looking for an active device record
    const otpDevice = await Device.findOne({
      userId: user._id,
      isTrusted: false,
      expiresAt: { $gt: new Date() }
    });

    const tokenPayload = { userId: user._id, role: user.role };
    if (otpDevice) {
      tokenPayload.sessionType = 'otp';
      tokenPayload.sessionExpiry = otpDevice.expiresAt.getTime();
      tokenPayload.deviceId = otpDevice.deviceId;
    }

    const accessToken = jwt.sign(
      tokenPayload,
      getJwtSecret(),
      { expiresIn: otpDevice ? "5h" : "15m" }
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
    const { token, requiredPermissions, signature, timestamp, method, url, bodyHash } = req.body;

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

    // Security lockout: hard block regardless of path (TPM or OTP)
    if (user.securityLockout) {
      return res.status(403).json({
        authorized: false,
        error: 'Account security-locked. Contact your administrator.',
        code: 'SECURITY_LOCKOUT'
      });
    }

    // --- ZERO-TRUST: CRYPTOGRAPHIC REQUEST SIGNATURE VERIFICATION ---
    if (signature && timestamp) {
      const { verifyRequestSignature } = require("./webauthn");
      const result = await verifyRequestSignature(decoded.userId, signature, timestamp, method, url, bodyHash);
      if (!result.valid) {
        return res.status(403).json({
          authorized: false,
          error: 'Invalid request signature',
          code: result.code || 'SIGNATURE_INVALID'
        });
      }
    } else {
      // No ECDSA signature — must be an OTP device session
      const { deviceId, userAgent } = req.body;
      if (deviceId) {
        // Clean up expired devices first
        await Device.deleteMany({ userId: decoded.userId, expiresAt: { $lt: new Date() } });
        const device = await Device.findOne({ userId: decoded.userId, deviceId });

        if (!device || (device.expiresAt && device.expiresAt < new Date())) {
          return res.status(403).json({ authorized: false, error: 'No valid session', code: 'SESSION_KEY_REQUIRED' });
        }

        // ── OTP 5-hour hard cap (JWT-level) ──────────────────────────────────
        // The sessionExpiry is baked into the JWT at token exchange time.
        // This is the authoritative cap — even if Device.expiresAt was modified in DB.
        if (decoded.sessionType === 'otp' && decoded.sessionExpiry) {
          if (Date.now() > decoded.sessionExpiry) {
            return res.status(401).json({
              authorized: false,
              error: 'OTP session expired (5-hour limit). Please login again.',
              code: 'OTP_SESSION_EXPIRED'
            });
          }
        }

        // ── OTP Device Fingerprint Check (3-strike lockout) ───────────────────
        // Only check if the device has a fingerprint stored (new sessions after this deploy)
        if (device.deviceFingerprint) {
          const currentFingerprint = computeFingerprint(userAgent || '');

          if (currentFingerprint !== device.deviceFingerprint) {
            // Mismatch: a different machine is using this deviceId
            user.securityIncidentCount = (user.securityIncidentCount || 0) + 1;

            if (user.securityIncidentCount >= 3) {
              // 3 strikes — full lockout
              await revokeAllAndLockout(user);
              return res.status(403).json({
                authorized: false,
                error: 'Security lockout: repeated suspicious access attempts detected. Contact your administrator.',
                code: 'SECURITY_LOCKOUT'
              });
            }

            await user.save();
            return res.status(403).json({
              authorized: false,
              error: `Device mismatch detected (attempt ${user.securityIncidentCount}/3). ` +
                `${3 - user.securityIncidentCount} more will trigger a security lockout.`,
              code: 'DEVICE_MISMATCH',
              attemptsRemaining: 3 - user.securityIncidentCount
            });
          }

          // Fingerprint matched — reset incident counter if it was non-zero
          if (user.securityIncidentCount > 0) {
            user.securityIncidentCount = 0;
            await user.save();
          }
        }

      } else {
        return res.status(403).json({ authorized: false, error: 'Request signature required', code: 'SESSION_KEY_REQUIRED' });
      }
    }

    // RBAC permission check
    const roleData = await Role.findOne({ name: user.role });
    const userPerms = roleData ? roleData.permissions : [];

    if (user.role === "superadmin" || userPerms.includes("Z_ALL")) {
      return res.json({ authorized: true, user: { userId: user._id, role: user.role } });
    }

    if (requiredPermissions && Array.isArray(requiredPermissions) && requiredPermissions.length > 0) {
      const hasAccess = requiredPermissions.every(rp => userPerms.includes(rp));
      if (!hasAccess) {
        user.riskScore += 10;
        if (user.riskScore > 90) user.isBlocked = true;
        await user.save();
        const message = user.isBlocked
          ? "You are blocked due to repeated failed attempts. Please contact admin."
          : "Insufficient permissions.";
        return res.status(403).json({ authorized: false, error: message });
      }
    }

    return res.json({ authorized: true, user: { userId: user._id, role: user.role } });
  } catch (error) {
    console.error("Centralized Verify error:", error);
    res.status(500).json({ authorized: false, error: "Internal server error" });
  }
};
