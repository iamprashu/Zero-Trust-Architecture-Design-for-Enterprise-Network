# 🏦 NexusBank — Zero Trust Architecture for Enterprise Network

> A production-grade banking application built from the ground up on **Zero Trust principles**: never trust, always verify — on every single request.

This project demonstrates how modern enterprise applications should handle security. Instead of relying on a simple "login once, trust forever" approach, every API call is independently authenticated, authorized, and cryptographically verified. Even if an attacker steals your tokens, they still can't do anything.

---

## 🎯 What This Project Does

NexusBank is a **full-stack banking platform** with two frontends (customer portal + admin panel), three backend microservices, and a shared database layer — all wired together through Nginx and Docker.

But the real story isn't banking. It's the **security architecture**:

- **OAuth2 Authorization Code Flow** — No tokens are directly exposed to the browser during login
- **Multi-Factor Authentication** — Password + TOTP (Google Authenticator) + WebAuthn (biometric/TPM)
- **Cryptographic Request Signing** — Every API call is signed with an ephemeral ECDSA key that exists only in browser memory
- **Refresh Token Rotation** — Stolen tokens are detected and all sessions are revoked
- **Dynamic RBAC** — Roles, permissions, and API mappings are fully configurable at runtime
- **Risk-Based Blocking** — Failed attempts increase a risk score; high-risk users are auto-blocked

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX GATEWAY                           │
│                      (Reverse Proxy, :80)                       │
├────────┬─────────────┬──────────────┬──────────────┬────────────┤
│  /     │  /admin/    │  /api/auth/  │  /api/banking│ /api/devices│
│        │             │  /api/admin/ │              │             │
└───┬────┴──────┬──────┴──────┬───────┴──────┬───────┴──────┬──────┘
    │           │             │              │              │
    ▼           ▼             ▼              ▼              ▼
┌────────┐ ┌────────┐  ┌──────────┐   ┌──────────┐  ┌───────────┐
│Banking │ │ Admin  │  │   Auth   │   │ Banking  │  │  Device   │
│   UI   │ │ Panel  │  │ Service  │   │ Service  │  │  Service  │
│ (React)│ │(React) │  │ (:5000)  │   │ (:5001)  │  │  (:5002)  │
└────────┘ └────────┘  └────┬─────┘   └────┬─────┘  └─────┬─────┘
                             │              │              │
                             └──────┬───────┘──────────────┘
                                    ▼
                              ┌──────────┐
                              │ MongoDB  │
                              │ (:27017) │
                              └──────────┘
```

### Services

| Service | Port | Responsibility |
|---------|------|----------------|
| **Auth Service** | 5000 | Login, OAuth2 flow, JWT management, MFA (TOTP + WebAuthn), session keys, RBAC, admin API |
| **Banking Service** | 5001 | Accounts, transactions, loans — all gated through centralized auth verification |
| **Device Service** | 5002 | Device trust management, OTP generation & verification, email notifications |
| **Nginx Gateway** | 80 | Reverse proxy routing all traffic to correct services |

### Frontends

| UI | Path | Built With |
|----|------|-----------|
| **Banking Portal** | `/` | React (Vite) — Customer-facing banking dashboard |
| **Admin Panel** | `/admin/` | React (Vite) — User management, roles, permissions, devices, audit logs |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v22+ 
- **pnpm** (recommended) or npm
- **MongoDB** (local or Atlas)
- **Docker & Docker Compose** (for containerized deployment)

### Option 1: Docker (Recommended)

The fastest way to get everything running:

```bash
# Clone the repo
git clone https://github.com/your-username/Zero-Trust-Architecture-Design-for-Enterprise-Network.git
cd Zero-Trust-Architecture-Design-for-Enterprise-Network

# Create your .env file
cp .env.example .env
# Edit .env with your values (MongoDB URI, secrets, email credentials)

# Build and start all services
docker compose up --build
```

Once running:
- **Banking UI**: http://localhost
- **Admin Panel**: http://localhost/admin/
- **Auth Service**: http://localhost/api/auth/
- **Banking API**: http://localhost/api/banking/

### Option 2: Local Development

```bash
# Install all dependencies across the monorepo
pnpm install

# Start all services and UIs in dev mode (with hot reload)
pnpm run dev

# Or use the convenience script
./start.sh
```

### Default Credentials

The auth service auto-seeds these users on startup:

| Email | Password | Role |
|-------|----------|------|
| `admin@gmail.com` | `admin@123` | Superadmin (from `.env`) |
| `admin@bank.local` | `password123` | Admin |
| `manager@bank.local` | `password123` | Manager |
| `teller@bank.local` | `password123` | Teller |
| `user@bank.local` | `password123` | User |

> ⚠️ **First login requires TOTP setup.** You'll be shown a QR code to scan with Google Authenticator (or any TOTP app). After that, you'll also register a WebAuthn device (biometric/PIN).

---

## 🔐 Security Architecture

This project implements **5 layers of defense** that work together to ensure zero trust:

### Layer 1: Multi-Factor Authentication

Every user goes through three authentication factors during login:

1. **Something you know** — Email + password (bcrypt hashed)
2. **Something you have** — TOTP code from Google Authenticator
3. **Something you are** — WebAuthn biometric (fingerprint, face) or device PIN via TPM

### Layer 2: OAuth2 Authorization Code Flow

Instead of directly handing tokens to the browser, the login flow follows proper OAuth2:

1. User authenticates → receives a **one-time authorization code** (5-minute TTL)
2. The code is exchanged for tokens via `POST /api/auth/token`
3. The authorization code is **deleted after use** — it cannot be replayed
4. The `refreshToken` is set as an **HttpOnly cookie** (invisible to JavaScript)

### Layer 3: Ephemeral Session Keys (ECDSA Request Signing)

This is the layer that makes stolen tokens useless:

- After login, the browser generates an **ECDSA P-256 key pair in memory**
- The private key is `{ extractable: false }` — it cannot be read, copied, or exported
- The public key is registered with the server
- **Every API request** includes an ECDSA signature: `ECDSA(method|url|timestamp|bodyHash)`
- The server verifies this signature before authorizing any action
- If the page is refreshed, the key is gone — user must re-authenticate

### Layer 4: Refresh Token Rotation

- On each refresh, a **new refresh token** is issued and the old one is invalidated
- The server compares the presented token against an **AES-256-CBC encrypted** copy stored in the database
- If there's a **mismatch** (indicating theft/reuse), **all tokens are revoked immediately**

### Layer 5: Dynamic RBAC with API Mapping

- Roles and permissions are stored in the database and can be modified at runtime
- Each API route is mapped to required permissions via the `ApiMapping` collection
- The system defaults to **deny** if no mapping exists for an endpoint (true zero-trust)
- Superadmin has a special `Z_ALL` permission that bypasses all checks

For a detailed analysis of what happens when an attacker steals tokens, see **[ATTACKER_SCENARIO.md](./ATTACKER_SCENARIO.md)**.

---

## 📁 Project Structure

```
Zero-Trust-Architecture-Design-for-Enterprise-Network/
│
├── docker-compose.yml          # Orchestrates all services + MongoDB + Nginx
├── nginx/
│   └── nginx.conf              # Reverse proxy configuration
│
├── packages/
│   └── db/                     # Shared database package (@repo/db)
│       └── src/
│           ├── connection.js   # MongoDB connection
│           ├── index.js        # Model exports
│           └── models/         # 13 Mongoose models
│               ├── User.js
│               ├── Role.js
│               ├── Permission.js
│               ├── Account.js
│               ├── Transaction.js
│               ├── AuditLog.js
│               ├── AuthCode.js
│               ├── Device.js
│               ├── DeviceOtp.js
│               ├── WebAuthnCredential.js
│               ├── SessionKey.js
│               ├── ApiMapping.js
│               └── RefreshToken.js
│
├── services/
│   ├── auth/                   # Authentication & Authorization service
│   │   ├── index.js            # Express app, bootstrap, seed data
│   │   ├── controllers/
│   │   │   ├── auth.js         # Login, OAuth2, MFA, token management
│   │   │   ├── admin.js        # User/role/permission/device management
│   │   │   └── webauthn.js     # FIDO2 WebAuthn registration & login
│   │   ├── middleware/
│   │   │   └── authMiddleware.js  # JWT verification, RBAC guard
│   │   └── utils/
│   │       └── encryption.js   # AES-256-CBC encryption for refresh tokens
│   │
│   ├── banking/                # Banking operations service
│   │   ├── index.js            # Account & transaction APIs
│   │   └── middleware/
│   │       └── authorize.js    # Centralized auth verification middleware
│   │
│   └── device-service/         # Device trust & OTP service
│       └── src/
│           └── index.ts        # Device management, OTP flow, email
│
├── ui/
│   ├── banking-ui/             # Customer-facing React app
│   │   └── src/
│   │       ├── App.jsx         # Auth flow, session key initialization
│   │       ├── utils/
│   │       │   ├── api.js      # Axios with request signing interceptor
│   │       │   └── crypto.js   # ECDSA key pair & request signing
│   │       └── pages/          # Login, Dashboard, Transactions, etc.
│   │
│   └── admin-panel/            # Admin React app
│       └── src/
│           └── pages/          # Users, Roles, Permissions, Devices, Audit Logs
│
├── .env.example                # Environment variable template
├── pnpm-workspace.yaml         # Monorepo workspace configuration
├── start.sh                    # Dev startup script
└── tsconfig.base.json          # Shared TypeScript configuration
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/zero-trust-db

# Auth Service
JWT_SECRET=your-strong-jwt-secret
REFRESH_SECRET=your-strong-refresh-secret
ENCRYPTION_KEY=your-aes-encryption-key
SUPERADMIN_EMAIL=admin@yourcompany.com
SUPERADMIN_PASSWORD=strong-password-here

# WebAuthn (FIDO2)
WEBAUTHN_RP_NAME=NexusBank
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost

# Device Service (Email / OTP)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_FROM="Zero Trust Security <your-gmail@gmail.com>"

# CORS
CORS_ORIGINS=http://localhost
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | Complete API reference for all endpoints |
| [USER_FLOWS.md](./USER_FLOWS.md) | Step-by-step user journey for every flow |
| [AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md) | Deep dive into authentication, authorization, and security layers |
| [DEVOPS.md](./DEVOPS.md) | Docker, deployment, CI/CD, and infrastructure guide |
| [ATTACKER_SCENARIO.md](./ATTACKER_SCENARIO.md) | What happens if an attacker steals tokens (attacker's POV) |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Complete database schema reference |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22 |
| **Backend Framework** | Express.js |
| **Frontend** | React (Vite) |
| **Database** | MongoDB + Mongoose |
| **Authentication** | JWT, bcryptjs, otplib (TOTP), @simplewebauthn/server |
| **Cryptography** | Web Crypto API (ECDSA P-256), AES-256-CBC, SHA-256 |
| **Email** | Nodemailer + Gmail SMTP |
| **Package Manager** | pnpm (monorepo workspaces) |
| **Containerization** | Docker + Docker Compose |
| **Reverse Proxy** | Nginx |
| **Language** | JavaScript (services), TypeScript (device service) |

---

## 📄 License

This project is built for educational and research purposes demonstrating Zero Trust Architecture patterns for enterprise networks.
