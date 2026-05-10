# 👤 User Flows — NexusBank Zero Trust Platform

> Every user journey mapped out step by step. This covers what actually happens at each stage — from the first login to daily banking operations.

---

## Table of Contents

- [Flow 1: First-Time User Login (Complete Onboarding)](#flow-1-first-time-user-login)
- [Flow 2: Returning User Login (Registered Device)](#flow-2-returning-user-login-registered-device)
- [Flow 3: New Device Login (OTP Fallback)](#flow-3-new-device-login-otp-fallback)
- [Flow 4: Device Revoked by Admin](#flow-4-device-revoked-by-admin)
- [Flow 5: Making a Banking API Call](#flow-5-making-a-banking-api-call)
- [Flow 6: Session Expiry & Token Refresh](#flow-6-session-expiry--token-refresh)
- [Flow 7: Page Refresh Behavior](#flow-7-page-refresh-behavior)
- [Flow 8: Admin Panel Operations](#flow-8-admin-panel-operations)
- [Flow 9: Superadmin Creates a New Employee](#flow-9-superadmin-creates-a-new-employee)
- [Flow 10: User Gets Blocked (Risk Score)](#flow-10-user-gets-blocked)

---

## Flow 1: First-Time User Login

This is the complete onboarding flow when a user has never logged in before. It involves setting up TOTP and registering a WebAuthn device.

```mermaid
flowchart TD
    A["User opens http://localhost"] --> B["Redirected to /login page"]
    B --> C["Clicks 'Login' → Redirected to auth service<br/>/api/login?redirect_uri=http://localhost"]
    C --> D["Server renders login form"]
    D --> E["User enters email + password"]
    E --> F{"POST /api/auth/authorize"}
    
    F --> G{"Is authenticator<br/>set up?"}
    G -->|"No (first time)"| H["Server generates TOTP secret<br/>Renders QR code page"]
    H --> I["User scans QR with<br/>Google Authenticator app"]
    I --> J["User enters 6-digit TOTP code"]
    J --> K{"POST /api/auth/setup-authenticator"}
    K --> L{"Is TOTP valid?"}
    L -->|"No"| M["Error: Invalid code. Try again."]
    L -->|"Yes"| N["isAuthenticatorSetup = true<br/>Renders WebAuthn registration page"]
    
    N --> O["User clicks 'Register Device'"]
    O --> P["Browser prompts for<br/>biometric/PIN via WebAuthn API"]
    P --> Q{"POST /api/auth/webauthn/register"}
    Q --> R["Credential stored in<br/>WebAuthnCredential collection"]
    R --> S["'Device registered!<br/>Redirecting to login...'"]
    S --> T["User redirected back to<br/>http://localhost<br/>(must login again to get tokens)"]
    
    T --> U["User goes through login again"]
    U --> V["This time: authenticator IS set up<br/>AND WebAuthn creds exist"]
    V --> W["Server renders WebAuthn<br/>verification page"]
    W --> X["User verifies with biometric/PIN"]
    X --> Y["Auth code generated → redirect"]
    Y --> Z["Code exchanged for tokens"]
    Z --> AA["Session key generated in memory"]
    AA --> AB["✅ User is fully logged in"]
    
    style AB fill:#10b981,color:#fff
    style M fill:#ef4444,color:#fff
```

### What gets created during this flow:

| Step | What's Created | Where |
|------|---------------|-------|
| TOTP Setup | `authenticatorSecret` on User document | MongoDB |
| WebAuthn Registration | `WebAuthnCredential` document | MongoDB |
| Login | `AuthCode` (one-time, 5-min TTL) | MongoDB |
| Token Exchange | `accessToken` (15-min JWT) | Browser `localStorage` |
| Token Exchange | `refreshToken` (7-day JWT, encrypted) | HttpOnly cookie + User document |
| Session Key | ECDSA key pair (P-256) | Browser memory (private), MongoDB (public) |

---

## Flow 2: Returning User Login (Registered Device)

The fast path — user has already set up TOTP and has a registered WebAuthn device.

```mermaid
flowchart TD
    A["User opens app → /login"] --> B["Clicks Login button"]
    B --> C["Redirected to /api/login?redirect_uri=http://localhost"]
    C --> D["Enters email + password"]
    D --> E{"POST /api/auth/authorize"}
    
    E --> F{"isAuthenticatorSetup?"}
    F -->|"Yes"| G{"Has WebAuthn creds?"}
    G -->|"Yes"| H["Server renders WebAuthn<br/>verification page"]
    H --> I["User clicks 'Verify with Biometric/PIN'"]
    I --> J["Browser shows biometric prompt<br/>(fingerprint, face ID, or PIN)"]
    J --> K{"WebAuthn assertion verified?"}
    K -->|"Yes"| L["Auth code created (5-min TTL)"]
    L --> M["Redirect to http://localhost?code=xxx"]
    M --> N["Frontend: POST /api/auth/token<br/>exchanges code for tokens"]
    N --> O["accessToken stored in localStorage<br/>refreshToken set as HttpOnly cookie"]
    O --> P["Frontend: Generates ECDSA key pair<br/>POST /api/auth/session-key"]
    P --> Q["✅ Logged in — Dashboard loads"]
    
    K -->|"No"| R["Risk score +10<br/>Error message shown"]
    
    style Q fill:#10b981,color:#fff
    style R fill:#ef4444,color:#fff
```

**Time to login:** ~5 seconds (password + one biometric touch)

---

## Flow 3: New Device Login (OTP Fallback)

When a user logs in from a device they haven't registered (or when they choose "Use different device").

```mermaid
flowchart TD
    A["User enters email + password"] --> B{"POST /api/auth/authorize"}
    B --> C{"Has WebAuthn creds?"}
    C -->|"Yes"| D["WebAuthn verification page shown"]
    D --> E["User clicks 'Use different device (OTP)'"]
    E --> F["Form resubmits with new_device=true"]
    
    C -->|"No (creds revoked)"| G["'No Device Registered' page shown"]
    G -->|"User clicks 'Use Temporary Session'"| F
    
    F --> H["Server renders TOTP verification page"]
    H --> I{"User has authenticator app?"}
    
    I -->|"Yes"| J["Enters 6-digit TOTP code"]
    J --> K{"POST /api/auth/verify-device-totp"}
    K -->|"Valid"| L["5-hour temp device session created<br/>Auth code generated"]
    K -->|"Invalid"| M["Risk score +10<br/>Error shown"]
    
    I -->|"No / prefers email"| N["Clicks 'Use email OTP instead'"]
    N --> O["POST /api/auth/fallback-otp"]
    O --> P["Device service sends 6-digit OTP to user's email"]
    P --> Q["User enters email OTP"]
    Q --> R{"POST /api/auth/authorize-otp"}
    R -->|"Valid"| L
    R -->|"Invalid"| S["Risk score +10<br/>Error shown"]
    
    L --> T["Redirect with auth code"]
    T --> U["Token exchange → Session key → ✅ Logged in"]
    
    style U fill:#10b981,color:#fff
    style M fill:#ef4444,color:#fff
    style S fill:#ef4444,color:#fff
```

### Important limitations of the temporary session:

| Aspect | Registered Device | Temporary Session |
|--------|------------------|-------------------|
| Duration | Until token expires (7 days) | **5 hours** |
| Trust Level | `isTrusted: true` (after admin approval) | `isTrusted: false` |
| Device Record | Permanent | Expires after 5 hours |
| Re-login Required | Only when tokens expire | Every 5 hours |

---

## Flow 4: Device Revoked by Admin

When an admin revokes a user's WebAuthn device from the admin panel.

```mermaid
flowchart TD
    A["Admin opens Admin Panel → Devices page"] --> B["Finds user's device credential"]
    B --> C["Clicks 'Revoke' on device"]
    C --> D["DELETE /api/admin/devices/:credentialId"]
    D --> E["WebAuthn credential deleted from DB<br/>All session keys for user deleted"]
    
    E --> F["Meanwhile: User's NEXT API call"]
    F --> G{"User's session key exists?"}
    G -->|"No (was deleted)"| H["403: SESSION_KEY_REQUIRED"]
    H --> I["Frontend dispatches 'session-expired' event"]
    I --> J["User sees 'Session expired' → Redirected to login"]
    
    J --> K["User enters email + password"]
    K --> L{"POST /api/auth/authorize"}
    L --> M{"Has WebAuthn creds?"}
    M -->|"No (all revoked)"| N["'No Device Registered' page"]
    N --> O{"User chooses:"}
    
    O -->|"Register new device"| P["WebAuthn registration flow<br/>(biometric/PIN)"]
    P --> Q["New credential stored → Login again"]
    
    O -->|"Temporary session"| R["TOTP or email OTP flow"]
    R --> S["5-hour temp session granted"]
    
    style H fill:#f59e0b,color:#000
    style N fill:#3b82f6,color:#fff
```

---

## Flow 5: Making a Banking API Call

What happens behind the scenes on every single API request after login.

```mermaid
sequenceDiagram
    participant B as Browser
    participant AX as Axios Interceptor
    participant CK as Crypto (in-memory)
    participant NG as Nginx
    participant BK as Banking Service
    participant AU as Auth Service

    B->>AX: api.get('/accounts')
    
    Note over AX: Request Interceptor kicks in
    AX->>AX: Attach Authorization: Bearer <token>
    AX->>CK: signRequest('GET', '/api/banking/accounts', null)
    CK->>CK: bodyHash = SHA-256('')
    CK->>CK: payload = "GET|/api/banking/accounts|1715345213000|e3b0c4..."
    CK->>CK: signature = ECDSA_SIGN(privateKey, payload)
    CK-->>AX: { signature, timestamp }
    AX->>AX: Attach X-Signature + X-Timestamp headers
    
    AX->>NG: GET /api/banking/accounts (with all headers)
    NG->>BK: Forward to banking service
    
    Note over BK: authorize(['READ_ACCOUNT']) middleware
    BK->>BK: Extract token + signature + timestamp
    BK->>BK: Compute bodyHash of request body
    BK->>AU: POST /api/auth/verify { token, signature, timestamp, method, url, bodyHash, requiredPermissions }
    
    Note over AU: Centralized verification
    AU->>AU: 1. Verify JWT (not expired, valid signature)
    AU->>AU: 2. Check user exists and not blocked/disabled
    AU->>AU: 3. Look up SessionKey for userId
    AU->>AU: 4. Verify timestamp within ±30 seconds
    AU->>AU: 5. Reconstruct payload and verify ECDSA signature
    AU->>AU: 6. Look up user's role → permissions
    AU->>AU: 7. Check requiredPermissions against user's permissions
    AU-->>BK: { authorized: true, user: { userId, role } }
    
    BK->>BK: Execute business logic (fetch accounts)
    BK-->>B: { accounts: [...] }
```

---

## Flow 6: Session Expiry & Token Refresh

The access token expires every 15 minutes. Here's what happens automatically.

```mermaid
flowchart TD
    A["User makes API call"] --> B{"Banking service returns<br/>401 Unauthorized?"}
    B -->|"No"| C["✅ Request succeeds normally"]
    B -->|"Yes (token expired)"| D["Axios response interceptor catches 401"]
    D --> E["POST /api/auth/refresh<br/>(sends refreshToken cookie)"]
    E --> F{"Refresh token valid?"}
    
    F -->|"Yes + matches DB"| G["New accessToken issued (15 min)<br/>New refreshToken issued (rotation)<br/>Old refreshToken invalidated"]
    G --> H["localStorage updated with new accessToken<br/>Cookie updated with new refreshToken"]
    H --> I["Original failed request RETRIED<br/>with new token"]
    I --> C
    
    F -->|"No (expired)"| J["401 → Clear tokens → Redirect to /login"]
    F -->|"Mismatch (possible theft)"| K["user.refreshToken = null<br/>ALL SESSIONS REVOKED"]
    K --> J
    
    style C fill:#10b981,color:#fff
    style J fill:#ef4444,color:#fff
    style K fill:#dc2626,color:#fff
```

---

## Flow 7: Page Refresh Behavior

This is unique to this architecture — **refreshing the page kills the session key**.

```mermaid
flowchart TD
    A["User refreshes the browser page (F5)"] --> B["ECDSA private key in memory is DESTROYED"]
    B --> C["Page reloads → App.jsx useEffect runs"]
    C --> D{"Is accessToken in localStorage?"}
    
    D -->|"No"| E["Show login page"]
    D -->|"Yes"| F["Try to re-initialize session key"]
    F --> G["Generate new ECDSA key pair"]
    G --> H["POST /api/auth/session-key<br/>with new public key"]
    H --> I{"Token still valid?"}
    
    I -->|"Yes"| J["New session key registered<br/>Old one replaced"]
    J --> K["✅ User continues working<br/>(seamless experience)"]
    
    I -->|"No (token expired)"| L["Try refresh token"]
    L --> M{"Refresh succeeds?"}
    M -->|"Yes"| J
    M -->|"No"| E
    
    style K fill:#10b981,color:#fff
    style E fill:#f59e0b,color:#000
```

> The page refresh is handled gracefully — if the access token (or refresh token) is still valid, the user doesn't need to re-login. A new session key is silently registered.

---

## Flow 8: Admin Panel Operations

### Managing Users

```mermaid
flowchart TD
    A["Admin logs into /admin/ panel"] --> B["Dashboard shows system stats"]
    B --> C["Navigates to Users page"]
    C --> D["GET /api/admin/users<br/>(superadmin only)"]
    D --> E["User list rendered"]
    
    E --> F{"Admin action:"}
    F -->|"Disable user"| G["PATCH /api/admin/users/disable<br/>{ userId, disabled: true }"]
    G --> H["User can't login or use API"]
    
    F -->|"Change role"| I["PATCH /api/admin/users/:id/role<br/>{ role: 'teller' }"]
    I --> J["User's permissions change immediately"]
    
    F -->|"Reset risk score"| K["PATCH /api/admin/users/risk<br/>{ userId, riskScore: 0 }"]
    K --> L["User unblocked if was blocked"]
    
    F -->|"Revoke devices"| M["DELETE /api/admin/users/:id/devices"]
    M --> N["All WebAuthn creds + session keys deleted<br/>User must re-register device"]
```

### Managing Roles & Permissions

```mermaid
flowchart TD
    A["Admin goes to Roles page"] --> B["GET /api/admin/roles"]
    B --> C["Sees all roles with their permissions"]
    
    C --> D{"Action:"}
    D -->|"Create role"| E["POST /api/admin/roles<br/>{ name: 'auditor', permissions: ['READ_ACCOUNT', 'READ_TRANSACTION'] }"]
    D -->|"Edit role"| F["PATCH /api/admin/roles/:id<br/>Rename cascades to all users with that role"]
    D -->|"Delete role"| G["DELETE /api/admin/roles/:id<br/>Fails if users are assigned to it"]
    
    A --> H["Admin goes to Permissions page"]
    H --> I["GET /api/admin/permissions"]
    I --> J{"Action:"}
    J -->|"Create"| K["POST /api/admin/permissions<br/>{ name: 'APPROVE_LOAN', description: '...' }"]
    J -->|"Delete"| L["Cascades: removed from all roles + API mappings"]
```

---

## Flow 9: Superadmin Creates a New Employee

End-to-end flow of adding a new bank employee to the system.

```mermaid
flowchart TD
    A["Superadmin logs in"] --> B["Goes to Admin Panel → Users"]
    B --> C["POST /api/admin/create-user<br/>{ email: 'newguy@bank.local',<br/>  password: 'temp123',<br/>  role: 'teller' }"]
    C --> D["User created with hashed password<br/>Role: teller"]
    
    D --> E["Superadmin tells new employee<br/>their credentials"]
    
    E --> F["New employee opens http://localhost"]
    F --> G["Enters email + password"]
    G --> H["First login → TOTP Setup"]
    H --> I["Scans QR code with<br/>authenticator app"]
    I --> J["Enters TOTP code → verified"]
    J --> K["WebAuthn device registration<br/>(fingerprint/PIN on work laptop)"]
    K --> L["Device registered → Login again"]
    L --> M["WebAuthn verification → Access granted"]
    M --> N["Employee can now use banking system<br/>with teller permissions:<br/>READ_ACCOUNT, CREATE_TRANSACTION, TRANSFER_MONEY"]
    
    style N fill:#10b981,color:#fff
```

---

## Flow 10: User Gets Blocked

The system automatically blocks users who exhibit suspicious behavior.

```mermaid
flowchart TD
    A["User attempts unauthorized action"] --> B["POST /api/auth/verify<br/>checks permissions"]
    B --> C{"Has required permissions?"}
    C -->|"No"| D["riskScore += 10"]
    D --> E{"riskScore > 90?"}
    E -->|"No"| F["403: Insufficient permissions<br/>(user can still retry)"]
    E -->|"Yes"| G["isBlocked = true<br/>403: 'You are blocked due to<br/>repeated failed attempts.<br/>Please contact admin.'"]
    
    G --> H["ALL subsequent requests blocked"]
    H --> I["User contacts admin"]
    I --> J["Admin goes to Users page"]
    J --> K["PATCH /api/admin/users/risk<br/>{ userId, riskScore: 0 }"]
    K --> L["isBlocked = false<br/>User can login again"]
    
    style G fill:#dc2626,color:#fff
    style L fill:#10b981,color:#fff
```

### What increases risk score:

| Action | Score Increase |
|--------|---------------|
| Failed permission check | +10 |
| Failed TOTP verification (new device) | +10 |
| Failed email OTP verification | +10 |
| Failed WebAuthn assertion | +10 |
| **Auto-block threshold** | **> 90** |

---

## Quick Reference: All User States

```mermaid
stateDiagram-v2
    [*] --> Created: Admin creates user
    Created --> TOTPSetup: First login
    TOTPSetup --> DeviceReg: TOTP verified
    DeviceReg --> Active: Device registered
    Active --> LoggedIn: Login (WebAuthn)
    Active --> TempSession: New device (OTP)
    TempSession --> Active: Session expires → re-login
    LoggedIn --> Active: Logout / token expires
    Active --> DeviceRevoked: Admin revokes device
    DeviceRevoked --> DeviceReg: User re-registers
    DeviceRevoked --> TempSession: User chooses OTP
    Active --> Disabled: Admin disables
    Active --> Blocked: Risk score > 90
    Blocked --> Active: Admin resets risk score
    Disabled --> Active: Admin re-enables
    Active --> Deleted: Admin soft-deletes
```
