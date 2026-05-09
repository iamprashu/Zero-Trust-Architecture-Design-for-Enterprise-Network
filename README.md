# Zero Trust Architecture Design for Enterprise Network

## Overview

**Zero Trust Architecture Design for Enterprise Network** is a comprehensive system design and security architecture project. It demonstrates how to build a robust microservices platform employing a **Zero Trust security model**, where no user, device, or service is inherently trusted. Every request must be authenticated, authorized, and verified.

The project simulates a secure banking enterprise environment encompassing user management, dynamic role-based access control (RBAC), and secure banking operations using modern web technologies.

---

## Architecture & Workflows

### Zero Trust Principles Implemented

1. **Strict Authentication & Device Verification:** Users log in via email and password, followed by mandatory Multi-Factor Authentication (MFA) via a TOTP Authenticator App or email fallback.
2. **Device Identity:** A device ID is securely persisted via `HttpOnly` cookies to track the trust level of the browser/device making the request. Unrecognized devices trigger step-up authentication.
3. **Role-Based Access Control (RBAC):** API endpoints map to specific permissions (e.g., `transactions:write`). A user's role dictates their permissions.
4. **Token-Based Security:** JSON Web Tokens (JWT) are used for stateless authentication with short-lived access tokens and secure refresh token rotation.
5. **No Direct Database Exposure:** Clients only interact with gateway/services. The database is isolated.

### Key Workflows

1. **Authentication Flow:**
   - User inputs credentials.
   - If the device is untrusted, a TOTP challenge is prompted.
   - Upon success, the server issues an `accessToken` and `refreshToken` securely via `HttpOnly` cookies.
2. **Authorization Flow:**
   - Client requests a protected resource (e.g., `/api/getTransaction`).
   - The Gateway/Service verifies the JWT and validates if the user's role contains the required permissions mapped to that specific endpoint.
3. **Banking Workflow:**
   - The user selects an active account (Checking, Savings, Loan).
   - The user can view transaction history, perform deposits/withdrawals, or request a loan.
   - All actions are logged and strictly enforce the RBAC policies (e.g., Clerks can view but not approve loans).

---

## Monorepo Structure & Modules

The application is structured as a monorepo utilizing `pnpm workspaces`:

```
Zero-Trust-Architecture-Design-for-Enterprise-Network/
│
├── services/                 # Backend Microservices
│   ├── auth/                 # Handles JWT, User creation, and RBAC evaluation
│   ├── banking/              # Core banking logic (Accounts, Transactions)
│   └── device-service/       # Zero-Trust device verification (TOTP/Email OTP)
│
├── ui/                       # Frontend Applications (Vite + React)
│   ├── admin-panel/          # Dashboard for managing Users, Roles, and Permissions
│   └── banking-ui/           # Customer-facing banking application
│
└── packages/                 # Shared Libraries
    ├── db/                   # Mongoose models and MongoDB connection logic
    └── g/                    # Miscellaneous shared configurations
```

---

## Tech Stack

### Backend
- **Node.js & Express.js**
- **MongoDB** (Database)
- **Mongoose** (ODM)
- **jsonwebtoken** (JWT management)
- **bcryptjs** (Password hashing)
- **otplib & qrcode** (TOTP implementation)
- **nodemailer** (Email services)

### Frontend
- **React 18**
- **Vite**
- **TailwindCSS / Vanilla CSS** (Glassmorphism UI design)
- **React Router DOM**
- **Axios** (API requests with interceptors for token refresh)

### DevOps & Infrastructure
- **Docker & Docker Compose**
- **Nginx** (Load Balancing and API Gateway)
- **pnpm** (Package Manager)
- **Turborepo** (Build System)

---

## High-Level APIs

### 1. Auth Service (`/api/auth` & `/api/admin`)
- `POST /api/auth/login`: Authenticates credentials and issues tokens.
- `POST /api/auth/logout`: Clears session tokens.
- `POST /api/auth/verify-access`: Internal endpoint used to verify if a JWT has access to a specific route based on RBAC.
- `GET /api/admin/users`: Fetches all registered users (Superadmin only).
- `PATCH /api/admin/users/risk`: Adjusts a user's risk score.
- `POST /api/admin/roles`: Creates a new RBAC role.

### 2. Device Service (`/device`)
- `POST /device/setup-totp`: Generates a TOTP secret and QR code for new devices.
- `POST /device/verify-totp`: Validates the TOTP code and marks the device as trusted.
- `POST /device/send-otp`: Sends a fallback OTP via email for untrusted devices.

### 3. Banking Service (`/api/banking`)
- `GET /api/banking/accounts`: Retrieves all accounts for the authenticated user.
- `POST /api/banking/transaction`: Processes a deposit or withdrawal.
- `POST /api/banking/loan`: Processes a loan request.

---

## Running Locally with Docker Compose

This project includes a comprehensive Docker Compose setup that demonstrates **Horizontal Scaling** and **Load Balancing** via Nginx. 

### Prerequisites
- Docker and Docker Compose installed.

### Start the Environment
1. Ensure your `.env` file is populated at the root level (use `.env.example` as a template).
2. Run the following command from the root directory:
   ```bash
   docker-compose up --build
   ```

### Accessing the Applications
With Nginx acting as a reverse proxy, access the applications at:
- **Banking UI**: `http://localhost/`
- **Admin Panel**: `http://localhost/admin`
- **API Endpoints**: `http://localhost/api/...`

### Horizontal Autoscaling Simulation
You can seamlessly scale the backend services to handle more load. For example, to scale the banking service to 3 instances:
```bash
docker-compose up --scale banking=3 -d
```
Nginx will automatically detect the new instances and begin round-robin load balancing traffic across all three containers.
