const { WebAuthnCredential, SessionKey, User } = require("@repo/db");
const crypto = require("crypto");

// RP (Relying Party) configuration from environment
const getRpName = () => process.env.WEBAUTHN_RP_NAME || "NexusBank";
const getRpId = () => process.env.WEBAUTHN_RP_ID || "localhost";
const getOrigin = () => process.env.WEBAUTHN_ORIGIN || "http://localhost";

// In-memory challenge store (keyed by a temporary token)
// In production, use Redis or a DB collection with TTL.
const challengeStore = new Map();

// Cleanup stale challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challengeStore) {
    if (now - val.createdAt > 5 * 60 * 1000) challengeStore.delete(key);
  }
}, 5 * 60 * 1000);

// ──────────────────────────────────────────────────────────────────────────
// REGISTRATION OPTIONS — Generate options for navigator.credentials.create()
// ──────────────────────────────────────────────────────────────────────────
exports.registrationOptions = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Load @simplewebauthn/server dynamically (ESM module)
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");

    // Get existing credentials for this user (to exclude re-registration)
    const existingCreds = await WebAuthnCredential.find({ userId });

    const options = await generateRegistrationOptions({
      rpName: getRpName(),
      rpID: getRpId(),
      userName: user.email,
      userID: new TextEncoder().encode(userId),
      userDisplayName: user.email,
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Only platform authenticators (TPM, biometric)
        userVerification: "required",
        residentKey: "preferred",
      },
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credentialId,
        type: "public-key",
        transports: c.transports,
      })),
    });

    // Store challenge for verification
    const challengeToken = crypto.randomBytes(16).toString("hex");
    challengeStore.set(challengeToken, {
      challenge: options.challenge,
      userId,
      createdAt: Date.now(),
    });

    res.json({ options, challengeToken });
  } catch (err) {
    console.error("WebAuthn registration options error:", err);
    res.status(500).json({ error: "Failed to generate registration options" });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// REGISTRATION VERIFY — Verify attestation and store credential
// ──────────────────────────────────────────────────────────────────────────
exports.registrationVerify = async (req, res) => {
  try {
    const { challengeToken, attestationResponse, deviceName } = req.body;

    const stored = challengeStore.get(challengeToken);
    if (!stored) {
      return res
        .status(400)
        .json({ error: "Challenge expired or not found" });
    }
    challengeStore.delete(challengeToken);

    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");

    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: stored.challenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Verification failed" });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Store credential in DB
    await WebAuthnCredential.create({
      userId: stored.userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      deviceName: deviceName || "Platform Authenticator",
      transports: attestationResponse.response?.transports || ["internal"],
    });

    res.json({
      success: true,
      message: "Device registered successfully",
      deviceType: credentialDeviceType,
    });
  } catch (err) {
    console.error("WebAuthn registration verify error:", err);
    res.status(500).json({ error: "Registration verification failed" });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// LOGIN OPTIONS — Generate options for navigator.credentials.get()
// ──────────────────────────────────────────────────────────────────────────
exports.loginOptions = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

    const userCreds = await WebAuthnCredential.find({ userId });
    if (!userCreds.length) {
      return res
        .status(404)
        .json({ error: "No WebAuthn credentials found for this user" });
    }

    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      allowCredentials: userCreds.map((c) => ({
        id: c.credentialId,
        type: "public-key",
        transports: c.transports,
      })),
      userVerification: "required",
    });

    const challengeToken = crypto.randomBytes(16).toString("hex");
    challengeStore.set(challengeToken, {
      challenge: options.challenge,
      userId,
      createdAt: Date.now(),
    });

    res.json({ options, challengeToken });
  } catch (err) {
    console.error("WebAuthn login options error:", err);
    res.status(500).json({ error: "Failed to generate login options" });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// LOGIN VERIFY — Verify assertion and issue auth code
// ──────────────────────────────────────────────────────────────────────────
exports.loginVerify = async (req, res) => {
  try {
    const { challengeToken, assertionResponse, redirect_uri } = req.body;

    const stored = challengeStore.get(challengeToken);
    if (!stored) {
      return res.status(400).json({ error: "Challenge expired or not found" });
    }
    challengeStore.delete(challengeToken);

    const cred = await WebAuthnCredential.findOne({
      userId: stored.userId,
      credentialId: assertionResponse.id,
    });

    if (!cred) {
      return res.status(400).json({ error: "Credential not found" });
    }

    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: stored.challenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        transports: cred.transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      // Increase risk score on failed attempt
      const user = await User.findById(stored.userId);
      if (user) {
        user.riskScore += 10;
        if (user.riskScore > 90) user.isBlocked = true;
        await user.save();
      }
      return res.status(400).json({ error: "Authentication failed" });
    }

    // Update counter
    cred.counter = verification.authenticationInfo.newCounter;
    await cred.save();

    // Generate auth code (same pattern as existing OAuth flow)
    const { AuthCode, AuditLog } = require("@repo/db");
    const code = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await AuthCode.create({
      code,
      userId: stored.userId,
      redirectUri: redirect_uri,
      expiresAt,
    });

    await AuditLog.create({
      userId: stored.userId,
      action: "webauthn_login",
    });

    res.json({ success: true, code, redirect_uri });
  } catch (err) {
    console.error("WebAuthn login verify error:", err);
    res.status(500).json({ error: "Authentication verification failed" });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// SESSION KEY — Store the client's ephemeral public key
// ──────────────────────────────────────────────────────────────────────────
exports.storeSessionKey = async (req, res) => {
  try {
    const { publicKeyJWK } = req.body;
    if (!publicKeyJWK) {
      return res.status(400).json({ error: "publicKeyJWK is required" });
    }

    // Get userId from JWT (this endpoint requires a valid JWT)
    let userId;
    const jwt = require("jsonwebtoken");
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies?.accessToken;
    if (!token) return res.status(401).json({ error: "Token required" });

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default_secret",
      );
      userId = decoded.userId;
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Remove any existing session keys for this user
    await SessionKey.deleteMany({ userId });

    // Store new session key — expires when JWT expires (15 min)
    // But we give it 7 days to match the refresh token cycle
    await SessionKey.create({
      userId,
      publicKeyJWK: JSON.stringify(publicKeyJWK),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({ success: true, message: "Session key stored" });
  } catch (err) {
    console.error("Store session key error:", err);
    res.status(500).json({ error: "Failed to store session key" });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// VERIFY SIGNATURE — Called by the centralized verify endpoint
// ──────────────────────────────────────────────────────────────────────────
exports.verifyRequestSignature = async (
  userId,
  signature,
  timestamp,
  method,
  url,
  bodyHash,
) => {
  // Find session key for user
  const sessionKey = await SessionKey.findOne({
    userId,
    expiresAt: { $gt: new Date() },
  });

  if (!sessionKey) {
    return { valid: false, code: "SESSION_KEY_REQUIRED" };
  }

  // Check timestamp tolerance (30 seconds)
  const now = Date.now();
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 30000) {
    return { valid: false, code: "TIMESTAMP_EXPIRED" };
  }

  // Reconstruct the signing payload
  const payload = `${method}|${url}|${timestamp}|${bodyHash}`;

  // Import the JWK public key
  const jwk = JSON.parse(sessionKey.publicKeyJWK);

  try {
    const publicKey = await globalThis.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    const signatureBuffer = Buffer.from(signature, "base64url");
    const dataBuffer = new TextEncoder().encode(payload);

    const isValid = await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBuffer,
      dataBuffer,
    );

    return { valid: isValid };
  } catch (err) {
    console.error("Signature verification error:", err);
    return { valid: false, code: "VERIFICATION_ERROR" };
  }
};
