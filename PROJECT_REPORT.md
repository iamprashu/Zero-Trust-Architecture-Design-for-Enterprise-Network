# Zero Trust Architecture Design for Enterprise Network
## Complete Project Report

---

## 1. Executive Summary

This project implements a **Zero Trust security architecture** for an enterprise banking system. The core principle is **"never trust, always verify"** — every request must cryptographically prove both **user identity** (JWT + MFA) and **device identity** (WebAuthn FIDO2 + per-request ECDSA signing).

The system uses **microservices architecture** with Docker containerization, Nginx load balancing, and MongoDB for persistence. It features a customer-facing banking application and an administrative control panel, both enforcing the same Zero Trust policies.

### Key Security Features
- **WebAuthn (FIDO2)** hardware-bound device verification using TPM/biometric
- **Per-request cryptographic signing** with ephemeral ECDSA P-256 session keys
- **Multi-Factor Authentication** via TOTP authenticator app + email OTP fallback
- **Dynamic RBAC** with permission-level granularity
- **Risk-based access control** with automatic blocking on suspicious activity
- **JWT + Refresh Token rotation** with encrypted token storage

---

## 2. System Architecture

### 2.1 High-Level Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        BUI["Banking UI<br/>(React + Vite)"]
        AUI["Admin Panel<br/>(React + Vite)"]
    end

    subgraph Gateway["API Gateway"]
        NGX["Nginx<br/>Load Balancer & Reverse Proxy"]
    end

    subgraph Services["Microservices Layer"]
        AUTH["Auth Service<br/>:5000"]
        BANK["Banking Service<br/>:5001"]
        DEV["Device Service<br/>:5002"]
    end

    subgraph Data["Data Layer"]
        MONGO[("MongoDB")]
    end

    subgraph Security["Security Layer (per request)"]
        JWT["JWT Verification"]
        SIG["ECDSA Signature Verification"]
        RBAC["RBAC Permission Check"]
    end

    BUI --> NGX
    AUI --> NGX
    NGX --> AUTH
    NGX --> BANK
    NGX --> DEV
    AUTH --> MONGO
    BANK --> MONGO
    DEV --> MONGO
    BANK -->|"POST /api/auth/verify"| AUTH
```

### 2.2 Monorepo Structure

```
Zero-Trust-Architecture/
├── services/
│   ├── auth/                    # Authentication, Authorization, WebAuthn
│   │   ├── controllers/
│   │   │   ├── auth.js          # Login, OAuth, token management
│   │   │   ├── admin.js         # User/Role/Permission CRUD
│   │   │   └── webauthn.js      # WebAuthn registration, login, session keys
│   │   ├── middleware/
│   │   │   └── authMiddleware.js # JWT verification, RBAC guards
│   │   └── routes/index.js
│   │
│   ├── banking/                 # Core banking operations
│   │   ├── middleware/
│   │   │   └── authorize.js     # Signature forwarding to auth service
│   │   └── index.js             # Accounts, transactions, loans
│   │
│   └── device-service/          # OTP management for new devices
│       └── src/index.ts         # Email OTP generation/verification
│
├── ui/
│   ├── banking-ui/              # Customer-facing React SPA
│   │   └── src/
│   │       ├── utils/
│   │       │   ├── api.js       # Axios + per-request signing
│   │       │   └── crypto.js    # ECDSA key generation + signing
│   │       └── pages/Login.jsx  # Dual-mode login (WebAuthn / OTP)
│   │
│   └── admin-panel/             # Admin React SPA
│       └── src/
│           ├── utils/
│           │   ├── api.js       # Axios + per-request signing
│           │   └── crypto.js    # ECDSA key generation + signing
│           └── pages/Login.jsx  # Dual-mode admin login
│
├── packages/
│   └── db/src/models/           # 13 Mongoose models (shared)
│
├── nginx/nginx.conf             # API Gateway configuration
├── docker-compose.yml           # Full stack orchestration
└── .env.example                 # Environment variable template
```

### 2.3 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite | SPA with glassmorphism UI |
| **Backend** | Node.js, Express.js | RESTful microservices |
| **Database** | MongoDB, Mongoose | Document store with TTL indexes |
| **Gateway** | Nginx | Reverse proxy, load balancing |
| **Auth** | JWT, bcryptjs | Token-based authentication |
| **MFA** | otplib, qrcode | TOTP authenticator app |
| **Device Security** | @simplewebauthn/server | WebAuthn FIDO2 verification |
| **Request Signing** | Web Crypto API (ECDSA P-256) | Per-request cryptographic proof |
| **Email** | Nodemailer | OTP delivery for new devices |
| **DevOps** | Docker, Docker Compose | Containerization & orchestration |
| **Build** | pnpm, Turborepo | Monorepo workspace management |

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ WebAuthnCredential : "registers devices"
    User ||--o{ SessionKey : "has session keys"
    User ||--o{ Device : "temp OTP sessions"
    User ||--o{ Account : "owns"
    User ||--o{ AuditLog : "generates"
    User ||--o| RefreshToken : "has"
    Account ||--o{ Transaction : "contains"
    Role ||--o{ User : "assigned to"
    Permission ||--o{ Role : "included in"
    ApiMapping ||--o{ Permission : "requires"

    User {
        ObjectId _id
        String email UK
        String password
        String role
        Number riskScore
        Boolean isBlocked
        Boolean disabled
        Boolean deleted
        String refreshToken
        String authenticatorSecret
        Boolean isAuthenticatorSetup
    }

    WebAuthnCredential {
        ObjectId _id
        ObjectId userId FK
        String credentialId UK
        String publicKey
        Number counter
        String deviceName
        Array transports
    }

    SessionKey {
        ObjectId _id
        ObjectId userId FK
        String publicKeyJWK
        Date expiresAt TTL
    }

    Device {
        ObjectId _id
        ObjectId userId FK
        String deviceId UK
        String deviceName
        Boolean isTrusted
        Date expiresAt
    }

    Account {
        ObjectId _id
        ObjectId userId FK
        String accountType
        Number balance
    }

    Transaction {
        ObjectId _id
        ObjectId accountId FK
        String type
        Number amount
        Date date
    }

    Role {
        ObjectId _id
        String name UK
        Array permissions
    }

    Permission {
        ObjectId _id
        String name UK
        String description
    }

    ApiMapping {
        ObjectId _id
        String route UK
        Array requiredPermissions
    }

    AuditLog {
        ObjectId _id
        ObjectId userId FK
        String action
        Date timestamp
    }
```

### 3.2 All Collections (13 Total)

| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `users` | User accounts with credentials and risk scores | email, password, role, riskScore, isBlocked |
| `webauthn_credentials` | WebAuthn public keys bound to hardware | userId, credentialId, publicKey, counter |
| `session_keys` | Ephemeral ECDSA session public keys (TTL auto-delete) | userId, publicKeyJWK, expiresAt |
| `devices` | Temporary device sessions from OTP flow (5-hour TTL) | userId, deviceId, isTrusted, expiresAt |
| `device_otps` | Pending OTP codes for device verification | userId, deviceId, otp, expiresAt |
| `accounts` | Banking accounts (Checking, Savings, Loan) | userId, accountType, balance |
| `transactions` | Financial transaction records | accountId, type, amount |
| `roles` | RBAC role definitions | name, permissions[] |
| `permissions` | Individual permission definitions | name, description |
| `api_mappings` | Route-to-permission mapping | route, requiredPermissions[] |
| `auth_codes` | OAuth authorization codes (5-min TTL) | code, userId, redirectUri |
| `refresh_tokens` | Encrypted refresh tokens | userId, token, expiresAt |
| `audit_logs` | Security event log | userId, action, timestamp |

---

## 4. Security Architecture

### 4.1 Zero Trust Verification Chain

Every API request passes through this verification chain:

```mermaid
flowchart LR
    A["Incoming<br/>Request"] --> B{"Valid JWT?"}
    B -- No --> C["401 Unauthorized"]
    B -- Yes --> D{"Has X-Signature<br/>+ X-Timestamp?"}
    D -- Yes --> E{"Verify ECDSA<br/>Signature"}
    E -- Invalid --> F["403 SIGNATURE_INVALID"]
    E -- Valid --> G{"Timestamp<br/>within ±30s?"}
    G -- No --> H["403 TIMESTAMP_EXPIRED"]
    G -- Yes --> I{"RBAC<br/>Permissions?"}
    D -- No --> J{"Has Device ID?<br/>(temp OTP session)"}
    J -- No --> K["403 SESSION_KEY_REQUIRED"]
    J -- Yes --> L{"Valid Device<br/>in DB?"}
    L -- No --> K
    L -- Yes --> I
    I -- Insufficient --> M["403 + riskScore += 10"]
    I -- Sufficient --> N["✅ Access Granted"]
```

### 4.2 WebAuthn (FIDO2) Device Verification

WebAuthn provides **hardware-bound, cryptographic device identity** that cannot be copied, stolen via XSS, or intercepted via MITM.

**How it works:**

| Step | Where | What Happens |
|------|-------|-------------|
| 1. Registration | Device TPM/Secure Enclave | Generates asymmetric key pair. Private key **never leaves hardware**. |
| 2. Public key stored | MongoDB (`webauthn_credentials`) | Server stores public key + credential ID |
| 3. Login challenge | Auth Service → Browser | Server sends random challenge bytes |
| 4. Hardware signing | Device TPM | User authenticates with biometric/PIN. TPM signs challenge with private key. |
| 5. Verification | Auth Service | Server verifies signature using stored public key |

**Security properties:**

| Attack Vector | Protection |
|--------------|-----------|
| Cookie theft (DevTools) | No cookies — key is in hardware |
| XSS reads credentials | JavaScript cannot access private key |
| MITM interception | Challenge is unique per login; replaying fails |
| Device cloning | Private key is non-exportable from TPM |
| Credential stuffing | Requires physical device + biometric/PIN |

### 4.3 Per-Request Cryptographic Signing

After WebAuthn login, every API call is **cryptographically signed** using an ephemeral ECDSA P-256 key pair:

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Browser Memory Only)                      │
│                                                      │
│  1. Generate ECDSA P-256 key pair                    │
│  2. Send public key to server                        │
│  3. For each request:                                │
│     payload = "POST|/api/banking/transfer|           │
│               1715280000000|a1b2c3d4e5f6..."         │
│     signature = ECDSA.sign(payload, privateKey)      │
│  4. Attach headers:                                  │
│     X-Signature: <base64url signature>               │
│     X-Timestamp: 1715280000000                       │
│                                                      │
│  ⚠️ Private key dies on page refresh/close           │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Server (Auth Service verify endpoint)               │
│                                                      │
│  1. Fetch session public key from SessionKey DB      │
│  2. Reconstruct payload from request metadata        │
│  3. crypto.subtle.verify(signature, publicKey)       │
│  4. Check timestamp within ±30 seconds               │
│  5. If valid → proceed to RBAC check                 │
└─────────────────────────────────────────────────────┘
```

**Signing payload format:**
```
${HTTP_METHOD}|${URL_PATH}|${UNIX_TIMESTAMP_MS}|${SHA256_OF_REQUEST_BODY}
```

### 4.4 Multi-Factor Authentication

| Factor | Implementation | When |
|--------|---------------|------|
| **Knowledge** | Email + Password (bcrypt hashed) | Every login |
| **Possession** | TOTP Authenticator App (Google Authenticator, Authy) | First-time setup + new device verification |
| **Possession (fallback)** | Email OTP (6-digit, 5-min expiry) | When TOTP not available |
| **Inherence/Hardware** | WebAuthn biometric/PIN (TPM-bound) | Every login from registered device |

### 4.5 Risk-Based Access Control

```mermaid
flowchart TD
    A["User attempts<br/>unauthorized action"] --> B["riskScore += 10"]
    B --> C{"riskScore > 90?"}
    C -- Yes --> D["Account auto-blocked<br/>isBlocked = true"]
    C -- No --> E["Access denied<br/>but account active"]
    D --> F["Admin must manually<br/>unblock via admin panel"]
```

---

## 5. Authentication & Authorization Flows

### 5.1 First-Time User Registration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Banking UI
    participant AUTH as Auth Service
    participant TPM as Device TPM
    participant DB as MongoDB

    U->>UI: Click "Secure Login"
    UI->>AUTH: GET /api/login?redirect_uri=http://localhost
    AUTH->>U: Render login form (email/password)
    U->>AUTH: POST /api/auth/authorize {email, password}
    AUTH->>AUTH: Validate credentials (bcrypt.compare)

    Note over AUTH: First time → no authenticator setup
    AUTH->>U: Render QR code page (TOTP setup)
    U->>U: Scan QR with authenticator app
    U->>AUTH: POST /api/auth/setup-authenticator {userId, token}
    AUTH->>AUTH: Verify TOTP code

    Note over AUTH: Chain into WebAuthn registration
    AUTH->>U: Render "Register Device" page
    U->>AUTH: Fetch /api/auth/webauthn/register-options
    AUTH->>U: Challenge + registration options
    U->>TPM: navigator.credentials.create()
    TPM->>U: Biometric/PIN prompt
    U->>TPM: Authenticate
    TPM->>U: Public key + attestation
    U->>AUTH: POST /api/auth/webauthn/register {attestation}
    AUTH->>DB: Store WebAuthnCredential {publicKey, credentialId}
    AUTH->>U: "Device registered! Redirecting..."
    U->>UI: Redirect to login page
```

### 5.2 Returning Login (Registered Device)

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Banking UI
    participant AUTH as Auth Service
    participant TPM as Device TPM
    participant DB as MongoDB

    U->>UI: Click "Secure Login (This Device)"
    UI->>AUTH: GET /api/login?redirect_uri=...
    AUTH->>U: Render login form
    U->>AUTH: POST /api/auth/authorize {email, password}
    AUTH->>DB: Check WebAuthnCredential exists for user
    AUTH->>U: Render WebAuthn challenge page

    U->>AUTH: Fetch /api/auth/webauthn/login-options
    AUTH->>U: Challenge + allowCredentials
    U->>TPM: navigator.credentials.get()
    TPM->>U: Biometric/PIN prompt
    U->>TPM: Authenticate
    TPM->>U: Signed assertion
    U->>AUTH: POST /api/auth/webauthn/login {assertion}
    AUTH->>DB: Verify signature with stored public key
    AUTH->>DB: Update counter (replay protection)
    AUTH->>DB: Create AuthCode
    AUTH->>U: {code: "abc123"}
    U->>UI: Redirect to /?code=abc123

    UI->>AUTH: POST /api/auth/token {code}
    AUTH->>UI: {accessToken, refreshToken (cookie)}
    Note over UI: Generate ECDSA P-256 key pair in memory
    UI->>AUTH: POST /api/auth/session-key {publicKeyJWK}
    AUTH->>DB: Store SessionKey {publicKeyJWK, expiresAt}
    Note over UI: All subsequent requests signed with private key
```

### 5.3 New Device / OTP Fallback Login

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Banking UI
    participant AUTH as Auth Service
    participant DEV as Device Service
    participant DB as MongoDB

    U->>UI: Click "Login from New Device (OTP)"
    UI->>AUTH: GET /api/login?redirect_uri=...&new_device=true
    AUTH->>U: Render login form
    U->>AUTH: POST /api/auth/authorize {email, password, new_device: true}
    AUTH->>U: Render TOTP/OTP verification page

    alt TOTP Authenticator
        U->>AUTH: POST /api/auth/verify-device-totp {token}
        AUTH->>AUTH: Verify TOTP
    else Email OTP Fallback
        U->>AUTH: POST /api/auth/fallback-otp
        AUTH->>DEV: POST /api/devices/otp/request
        DEV->>U: Send 6-digit OTP via email
        U->>AUTH: POST /api/auth/authorize-otp {otp}
        AUTH->>DEV: POST /api/devices/otp/verify
    end

    AUTH->>DB: Create Device {expiresAt: +5 hours, isTrusted: false}
    AUTH->>U: Redirect with auth code
    Note over UI: 5-hour temporary session (no signing)
```

### 5.4 Per-Request Authorization Flow

```mermaid
sequenceDiagram
    participant UI as Banking UI
    participant BANK as Banking Service
    participant AUTH as Auth Service
    participant DB as MongoDB

    UI->>UI: Sign request: ECDSA.sign("GET|/accounts|ts|hash")
    UI->>BANK: GET /api/banking/accounts<br/>Authorization: Bearer JWT<br/>X-Signature: <sig><br/>X-Timestamp: <ts>

    BANK->>BANK: Extract JWT, signature, timestamp
    BANK->>BANK: Compute SHA-256 of request body
    BANK->>AUTH: POST /api/auth/verify<br/>{token, signature, timestamp, method, url, bodyHash, requiredPermissions}

    AUTH->>AUTH: Verify JWT
    AUTH->>DB: Check user not blocked/disabled
    AUTH->>DB: Fetch SessionKey for user
    AUTH->>AUTH: Reconstruct signing payload
    AUTH->>AUTH: crypto.subtle.verify(signature, publicKey)
    AUTH->>AUTH: Check timestamp ±30 seconds
    AUTH->>DB: Fetch Role → check permissions
    AUTH->>BANK: {authorized: true, user: {...}}

    BANK->>DB: Fetch accounts
    BANK->>UI: {accounts: [...]}
```

---

## 6. API Reference

### 6.1 Auth Service (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/login` | None | Renders server-side login page |
| POST | `/api/auth/authorize` | None | Validates credentials, initiates MFA |
| POST | `/api/auth/setup-authenticator` | None | Verifies TOTP setup, chains to WebAuthn reg |
| POST | `/api/auth/verify-device-totp` | None | Verifies TOTP for new device |
| POST | `/api/auth/fallback-otp` | None | Requests email OTP for new device |
| POST | `/api/auth/authorize-otp` | None | Verifies email OTP |
| POST | `/api/auth/token` | None | Exchanges auth code for JWT |
| POST | `/api/auth/verify` | Internal | Centralized JWT + signature + RBAC verification |
| POST | `/api/auth/refresh` | Cookie | Rotates access + refresh tokens |
| POST | `/api/auth/logout` | JWT | Clears session |
| POST | `/api/auth/login` | None | Legacy direct login (admin panel) |

### 6.2 WebAuthn Endpoints (`/api/auth/webauthn`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/webauthn/register-options` | None | Generates WebAuthn registration challenge |
| POST | `/api/auth/webauthn/register` | None | Verifies attestation, stores credential |
| POST | `/api/auth/webauthn/login-options` | None | Generates WebAuthn authentication challenge |
| POST | `/api/auth/webauthn/login` | None | Verifies assertion, issues auth code |
| POST | `/api/auth/session-key` | JWT | Stores ephemeral session public key |

### 6.3 Admin Endpoints (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | JWT + RBAC | List all users |
| POST | `/api/admin/users` | JWT + RBAC | Create user |
| PATCH | `/api/admin/users/:id/role` | JWT + RBAC | Update user role |
| POST | `/api/admin/users/disable` | JWT + RBAC | Disable/enable user |
| PATCH | `/api/admin/users/risk` | JWT + RBAC | Adjust risk score |
| GET | `/api/admin/roles` | JWT + RBAC | List roles |
| POST | `/api/admin/roles` | JWT + RBAC | Create role |
| GET | `/api/admin/permissions` | JWT + RBAC | List permissions |
| POST | `/api/admin/permissions` | JWT + RBAC | Create permission |
| GET | `/api/admin/audit-logs` | JWT + RBAC | View audit logs |

### 6.4 Banking Endpoints (`/api/banking`)

| Method | Endpoint | Auth | Permissions Required |
|--------|----------|------|---------------------|
| GET | `/api/banking/accounts` | JWT + Signature | `accounts:read` |
| POST | `/api/banking/accounts` | JWT + Signature | `accounts:write` |
| GET | `/api/banking/transactions/:id` | JWT + Signature | `transactions:read` |
| POST | `/api/banking/transaction` | JWT + Signature | `transactions:write` |
| POST | `/api/banking/loan` | JWT + Signature | `loans:write` |

### 6.5 Device Service (`/api/devices`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/devices` | JWT | List registered devices |
| POST | `/api/devices/otp/request` | Internal | Generate and email OTP |
| POST | `/api/devices/otp/verify` | Internal | Verify OTP, create device session |
| PATCH | `/api/devices/:id/approve` | JWT | Admin: approve device (permanent trust) |
| PATCH | `/api/devices/:id/revoke` | JWT | Admin: revoke device |

---

## 7. RBAC (Role-Based Access Control)

### 7.1 Permission Hierarchy

```mermaid
graph TD
    SA["superadmin<br/>(bypasses all checks)"]
    ZA["Z_ALL permission<br/>(full access via RBAC)"]
    
    subgraph Permissions
        AR["accounts:read"]
        AW["accounts:write"]
        TR["transactions:read"]
        TW["transactions:write"]
        LR["loans:read"]
        LW["loans:write"]
    end

    SA -.->|"implicit"| ZA
    ZA -->|"includes all"| AR
    ZA -->|"includes all"| AW
    ZA -->|"includes all"| TR
    ZA -->|"includes all"| TW
    ZA -->|"includes all"| LR
    ZA -->|"includes all"| LW
```

### 7.2 Dynamic API Mapping

Routes are mapped to permissions via the `ApiMapping` collection. This allows **runtime permission changes** without code deployment:

```json
{
  "route": "GET:/api/banking/accounts",
  "requiredPermissions": ["accounts:read"]
}
```

---

## 8. Infrastructure

### 8.1 Docker Compose Services

| Service | Port | Replicas | Purpose |
|---------|------|----------|---------|
| `nginx` | 80 | 1 | API Gateway + Load Balancer |
| `auth-service` | 5000 | scalable | Authentication, Authorization, WebAuthn |
| `banking-service` | 5001 | scalable | Banking operations |
| `device-service` | 5002 | scalable | OTP management |
| `banking-ui` | 80 | 1 | Customer frontend |
| `admin-ui` | 80 | 1 | Admin frontend |
| `mongodb` | 27017 | 1 | Database |

### 8.2 Horizontal Scaling

```bash
# Scale auth service to 3 replicas
docker-compose up --scale auth-service=3 -d

# Scale banking service to 3 replicas
docker-compose up --scale banking-service=3 -d
```

Nginx automatically load-balances across all replicas using round-robin.

### 8.3 Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `MONGO_URI` | All | MongoDB connection string |
| `JWT_SECRET` | Auth | JWT signing secret |
| `REFRESH_SECRET` | Auth | Refresh token signing secret |
| `SUPERADMIN_EMAIL` | Auth | Default superadmin email |
| `SUPERADMIN_PASSWORD` | Auth | Default superadmin password |
| `WEBAUTHN_RP_NAME` | Auth | WebAuthn Relying Party display name |
| `WEBAUTHN_RP_ID` | Auth | WebAuthn domain identifier |
| `WEBAUTHN_ORIGIN` | Auth | Expected origin for WebAuthn verification |
| `EMAIL_USER` | Device | SMTP email for OTP delivery |
| `EMAIL_PASS` | Device | SMTP app password |
| `AUTH_VERIFY_URL` | Banking | URL to auth service verify endpoint |
| `CORS_ORIGINS` | All | Allowed CORS origins |

---

## 9. Security Comparison

### 9.1 Before vs After WebAuthn Implementation

| Aspect | Before (Cookie-based) | After (WebAuthn + Signing) |
|--------|----------------------|---------------------------|
| Device identity | UUID string in cookie | Hardware-bound key in TPM |
| Proof mechanism | Client sends a string | Cryptographic signature |
| Copyable? | Yes (DevTools → copy) | No (private key in hardware) |
| XSS vulnerable? | Yes (not HttpOnly) | No (JS can't access private key) |
| MITM vulnerable? | Partially (if no HTTPS) | No (unique challenge per login) |
| Per-request verification | None | ECDSA signature on every call |
| Superadmin bypass | Yes (skipped all device checks) | No (all users verified equally) |
| Session persistence | 1-year cookie | Memory only (dies on refresh) |
| Replay protection | None | Timestamp ±30s + counter |
| Cost | Free | Free (Web Standards) |

### 9.2 Attack Resistance Matrix

| Attack | Cookie System | WebAuthn + Signing |
|--------|--------------|-------------------|
| Stolen JWT used from another machine | ✅ Works (just copy the cookie too) | ❌ Blocked (no private key) |
| XSS steals device identity | ✅ `document.cookie` readable | ❌ Private key not in JS |
| Physical access to unlocked device | ✅ Copy cookie in 5 seconds | ⚠️ Requires biometric/PIN |
| Man-in-the-Middle | ⚠️ Cookie visible without HTTPS | ❌ Challenge-response is unique |
| Session replay attack | ✅ Same cookie works forever | ❌ Timestamp + counter validation |
| Cross-site request forgery | ⚠️ Cookie sent automatically | ❌ Signature can't be forged |

---

## 10. Running the Project

### Prerequisites
- Docker and Docker Compose installed
- pnpm (for local development)

### Quick Start
```bash
# Clone the repository
git clone <repo-url>
cd Zero-Trust-Architecture-Design-for-Enterprise-Network

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB URI

# Build and run
docker-compose up --build
```

### Access Points
| Application | URL |
|------------|-----|
| Banking UI | http://localhost/ |
| Admin Panel | http://localhost/admin |
| Auth API | http://localhost/api/auth/ |
| Banking API | http://localhost/api/banking/ |

### Default Admin Credentials
```
Email:    admin@gmail.com
Password: admin@123
```
> On first login, admin goes through the same TOTP + WebAuthn setup as all users.

---

## 11. Audit & Compliance

All security-relevant events are logged in the `audit_logs` collection:

| Action | When Logged |
|--------|------------|
| `login` | Successful credential authentication |
| `logout` | User-initiated session termination |
| `oauth_authorize` | OAuth authorization code issued |
| `webauthn_login` | Successful WebAuthn device authentication |
| `webauthn_register` | New WebAuthn device credential registered |

Risk scores are tracked per-user and auto-increment on unauthorized access attempts. Accounts are automatically blocked when `riskScore > 90`.

---

*Report generated for Zero Trust Architecture Design for Enterprise Network — May 2026*
