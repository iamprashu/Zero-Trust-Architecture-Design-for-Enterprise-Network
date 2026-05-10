# 📡 API Documentation — NexusBank Zero Trust Platform

> Complete API reference for all three backend microservices. Every endpoint, every parameter, every response.

---

## Table of Contents

- [Base URLs](#base-urls)
- [Authentication Headers](#authentication-headers)
- [Auth Service API](#auth-service-api)
  - [OAuth2 Flow](#oauth2-flow)
  - [MFA Setup](#mfa-setup)
  - [Token Management](#token-management)
  - [WebAuthn (FIDO2)](#webauthn-fido2)
  - [Session Keys](#session-keys)
- [Admin API](#admin-api)
  - [User Management](#user-management)
  - [Role Management](#role-management)
  - [Permission Management](#permission-management)
  - [API Mapping](#api-mapping)
  - [Device Management](#device-management-webauthn)
  - [Audit Logs](#audit-logs)
- [Banking Service API](#banking-service-api)
  - [Accounts](#accounts)
  - [Transactions](#transactions)
  - [Loans](#loans)
- [Device Service API](#device-service-api)
  - [Device Check](#device-check)
  - [OTP Flow](#otp-flow)
  - [Admin Device Operations](#admin-device-operations)
- [Error Codes Reference](#error-codes-reference)

---

## Base URLs

| Service | Direct URL | Via Nginx Gateway |
|---------|-----------|-------------------|
| Auth Service | `http://localhost:5000/api` | `http://localhost/api` |
| Banking Service | `http://localhost:5001/api/banking` | `http://localhost/api/banking` |
| Device Service | `http://localhost:5002/api/devices` | `http://localhost/api/devices` |

All examples below use the **Nginx Gateway** URLs.

---

## Authentication Headers

### Standard JWT Authentication
```
Authorization: Bearer <accessToken>
```

### Cryptographic Request Signing (Required for Banking API)
```
Authorization: Bearer <accessToken>
X-Signature: <ecdsa_base64url_signature>
X-Timestamp: <unix_milliseconds>
```

### Cookie-Based Authentication
The `refreshToken` is sent automatically via HttpOnly cookie. No manual header needed.

---

## Auth Service API

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "auth-service"
}
```

---

### OAuth2 Flow

#### Render Login Page

```
GET /api/login?redirect_uri=<url>
```

Renders a server-side login form. After successful authentication, the user is redirected to `redirect_uri?code=<auth_code>`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `redirect_uri` | Query | ✅ | URL to redirect to after successful login |

---

#### Authorize (Login Submit)

```
POST /api/auth/authorize
Content-Type: application/x-www-form-urlencoded
```

This is the main login endpoint. Depending on the user's state, it will:
1. Show TOTP setup page (first-time users)
2. Show WebAuthn device verification (returning users with registered devices)
3. Show device re-registration page (users whose devices were revoked)
4. Show TOTP/OTP verification page (new device login)
5. Redirect with authorization code (all checks passed)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | Body | ✅ | User email address |
| `password` | Body | ✅ | User password |
| `redirect_uri` | Body | ✅ | Where to redirect after auth |
| `new_device` | Body | ❌ | Set to `"true"` to skip WebAuthn and use OTP instead |

**Success Response:** `302 Redirect` to `redirect_uri?code=<32-char-hex>`

---

#### Exchange Code for Token

```
POST /api/auth/token
Content-Type: application/json
```

Exchanges a one-time authorization code for access + refresh tokens.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | Body | ✅ | Authorization code from the redirect |

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

> The `refreshToken` is set as an **HttpOnly cookie** — it is not included in the JSON response.

---

#### Refresh Token

```
POST /api/auth/refresh
Cookie: refreshToken=<jwt>
```

Issues a new access token using the refresh token cookie. Implements **refresh token rotation** — the old refresh token is invalidated and a new one is issued.

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Error — Token Mismatch (possible theft):**
```json
{
  "error": "Refresh token mismatch. Access revoked."
}
```

> ⚠️ A mismatch means someone reused an old token — the server **nukes all tokens** for safety.

---

#### Legacy Login

```
POST /api/auth/login
Content-Type: application/json
```

Direct token-based login (kept for backward compatibility). Does **not** go through the OAuth2 code flow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | Body | ✅ | User email |
| `password` | Body | ✅ | User password |

**Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "60d5f484f1a2c8b1f8e4e1a1",
    "email": "user@bank.local",
    "role": "user"
  }
}
```

---

#### Logout

```
POST /api/auth/logout
Authorization: Bearer <accessToken>
```

Clears access and refresh token cookies. Requires a valid JWT.

**Response:**
```json
{
  "message": "Logout successful"
}
```

---

### MFA Setup

#### Setup Authenticator (TOTP)

```
POST /api/auth/setup-authenticator
Content-Type: application/x-www-form-urlencoded
```

Verifies the TOTP code during first-time authenticator setup, then chains into WebAuthn device registration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User's MongoDB ObjectId |
| `token` | Body | ✅ | 6-digit TOTP code from authenticator app |

**Response:** Renders WebAuthn device registration page (HTML).

---

#### Verify Device TOTP

```
POST /api/auth/verify-device-totp
Content-Type: application/x-www-form-urlencoded
```

Verifies TOTP for new device login flow. Creates a temporary 5-hour device session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User ID |
| `deviceId` | Body | ✅ | Temporary device identifier |
| `token` | Body | ✅ | 6-digit TOTP code |
| `redirect_uri` | Body | ✅ | Redirect URL |

**Success:** `302 Redirect` to `redirect_uri?code=<auth_code>`

---

#### Fallback OTP (Email)

```
POST /api/auth/fallback-otp
Content-Type: application/x-www-form-urlencoded
```

Triggers an email OTP instead of TOTP for new device verification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User ID |
| `deviceId` | Body | ✅ | Temporary device identifier |
| `redirect_uri` | Body | ✅ | Redirect URL |

**Response:** Renders OTP entry page (HTML).

---

#### Authorize OTP

```
POST /api/auth/authorize-otp
Content-Type: application/x-www-form-urlencoded
```

Verifies the email OTP and completes the new device login.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User ID |
| `deviceId` | Body | ✅ | Device identifier |
| `otp` | Body | ✅ | 6-digit email OTP |
| `redirect_uri` | Body | ✅ | Redirect URL |

**Success:** `302 Redirect` to `redirect_uri?code=<auth_code>`

---

### Token Management

#### Verify Token (Centralized)

```
POST /api/auth/verify
Content-Type: application/json
```

The **centralized verification endpoint** called by all other services before processing requests. Verifies JWT + cryptographic signature + RBAC permissions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | Body | ✅ | JWT access token |
| `requiredPermissions` | Body | ❌ | Array of permission strings (e.g., `["READ_ACCOUNT"]`) |
| `signature` | Body | ❌ | ECDSA request signature (base64url) |
| `timestamp` | Body | ❌ | Unix timestamp (ms) of when the request was signed |
| `method` | Body | ❌ | HTTP method (e.g., `"GET"`) |
| `url` | Body | ❌ | Request URL path |
| `bodyHash` | Body | ❌ | SHA-256 hash of the request body |
| `deviceId` | Body | ❌ | Device ID (for temp session devices without signatures) |

**Success Response:**
```json
{
  "authorized": true,
  "user": {
    "userId": "60d5f484f1a2c8b1f8e4e1a1",
    "role": "admin"
  }
}
```

**Error Responses:**
```json
{ "authorized": false, "error": "Request signature required", "code": "SESSION_KEY_REQUIRED" }
{ "authorized": false, "error": "Invalid request signature", "code": "SIGNATURE_INVALID" }
{ "authorized": false, "error": "Invalid request signature", "code": "TIMESTAMP_EXPIRED" }
{ "authorized": false, "error": "Insufficient permissions." }
{ "authorized": false, "error": "User is blocked or disabled" }
```

---

#### Verify Access (RBAC-only)

```
POST /api/auth/verify-access
Content-Type: application/json
```

Simplified verification that checks JWT + RBAC via API Mapping (no signature verification). Used for admin panel routes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `endpoint` | Body | ✅ | The API route to check (e.g., `/api/admin/users`) |

Uses `Authorization` header or `accessToken` cookie for the JWT.

**Response:**
```json
{ "authorised": true }
```

---

### WebAuthn (FIDO2)

#### Registration Options

```
POST /api/auth/webauthn/register-options
Content-Type: application/json
```

Generates WebAuthn registration options for `navigator.credentials.create()`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User's MongoDB ID |

**Response:**
```json
{
  "options": {
    "challenge": "base64url-encoded-challenge",
    "rp": { "name": "NexusBank", "id": "localhost" },
    "user": { "id": "...", "name": "user@bank.local", "displayName": "user@bank.local" },
    "authenticatorSelection": {
      "authenticatorAttachment": "platform",
      "userVerification": "required"
    }
  },
  "challengeToken": "hex-token-for-verification"
}
```

---

#### Registration Verify

```
POST /api/auth/webauthn/register
Content-Type: application/json
```

Verifies the attestation response and stores the credential.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `challengeToken` | Body | ✅ | Token from registration options |
| `attestationResponse` | Body | ✅ | The credential response from `navigator.credentials.create()` |
| `deviceName` | Body | ❌ | Human-readable device name |

**Response:**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "deviceType": "singleDevice"
}
```

---

#### Login Options

```
POST /api/auth/webauthn/login-options
Content-Type: application/json
```

Generates authentication options for `navigator.credentials.get()`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User's MongoDB ID |

---

#### Login Verify

```
POST /api/auth/webauthn/login
Content-Type: application/json
```

Verifies the assertion response and issues an authorization code.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `challengeToken` | Body | ✅ | Token from login options |
| `assertionResponse` | Body | ✅ | The assertion response from `navigator.credentials.get()` |
| `redirect_uri` | Body | ✅ | Redirect URL |

**Response:**
```json
{
  "success": true,
  "code": "32-char-hex-authorization-code",
  "redirect_uri": "http://localhost"
}
```

---

### Session Keys

#### Store Session Key

```
POST /api/auth/session-key
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Registers the client's ephemeral ECDSA public key for request signature verification. Called once after login.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `publicKeyJWK` | Body | ✅ | JWK-format ECDSA P-256 public key |

**Response:**
```json
{
  "success": true,
  "message": "Session key stored"
}
```

---

## Admin API

> All admin endpoints require `Authorization: Bearer <accessToken>` and the user must have appropriate role/permissions.

### User Management

#### Create User (Superadmin Only)

```
POST /api/admin/create-user
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | Body | ✅ | User email |
| `password` | Body | ✅ | User password |
| `role` | Body | ✅ | Role name (e.g., `"admin"`, `"teller"`, `"user"`) |

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": { "id": "...", "email": "new@bank.local", "role": "teller" }
}
```

---

#### List Users (Superadmin Only)

```
GET /api/admin/users
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "users": [
    {
      "_id": "...",
      "email": "admin@bank.local",
      "role": "admin",
      "riskScore": 0,
      "disabled": false,
      "isBlocked": false,
      "deleted": false,
      "isAuthenticatorSetup": true
    }
  ]
}
```

---

#### Disable/Enable User

```
PATCH /api/admin/users/disable
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User's MongoDB ID |
| `disabled` | Body | ✅ | `true` to disable, `false` to enable |

---

#### Soft Delete User

```
PATCH /api/admin/users/delete
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User's MongoDB ID |
| `deleted` | Body | ✅ | `true` to mark as deleted |

---

#### Update User Role

```
PATCH /api/admin/users/:userId/role
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Path | ✅ | User's MongoDB ID |
| `role` | Body | ✅ | New role name |

---

#### Update Risk Score

```
PATCH /api/admin/users/risk
Authorization: Bearer <accessToken>
Content-Type: application/json
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User's MongoDB ID |
| `riskScore` | Body | ✅ | New risk score (0-100). Users with score > 90 are auto-blocked. |

---

### Role Management

#### Create Role

```
POST /api/admin/roles
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | Body | ✅ | Role name |
| `permissions` | Body | ✅ | Array of permission names |

---

#### List Roles

```
GET /api/admin/roles
```

---

#### Update Role

```
PATCH /api/admin/roles/:id
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | Body | ❌ | New role name (cascades to all users with this role) |
| `permissions` | Body | ❌ | Updated permissions array |

---

#### Delete Role

```
DELETE /api/admin/roles/:id
```

> Returns error if any users are assigned to the role.

---

### Permission Management

#### Create Permission

```
POST /api/admin/permissions
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | Body | ✅ | Permission name (e.g., `READ_ACCOUNT`) |
| `description` | Body | ❌ | Human-readable description |

---

#### List Permissions

```
GET /api/admin/permissions
```

---

#### Update Permission

```
PATCH /api/admin/permissions/:id
```

> Name changes cascade to all roles and API mappings.

---

#### Delete Permission

```
DELETE /api/admin/permissions/:id
```

> Cascades: removes permission from all roles and API mappings.

---

### API Mapping

#### Create/Update API Mapping

```
POST /api/admin/mappings
Content-Type: application/json
```

Maps an API route to required permissions. Upserts — if the route already exists, it updates the permissions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `route` | Body | ✅ | API route path (e.g., `/api/banking/accounts`) |
| `requiredPermissions` | Body | ✅ | Array of required permission names |

---

#### List API Mappings

```
GET /api/admin/mappings
```

---

### Device Management (WebAuthn)

#### List User Devices

```
GET /api/admin/users/:userId/devices
```

Returns all WebAuthn credentials registered for a user.

---

#### Revoke Specific Device

```
DELETE /api/admin/devices/:credentialId
```

Deletes a specific WebAuthn credential and invalidates all session keys for the user.

**Response:**
```json
{
  "message": "Device revoked. User will need to re-register or use OTP on next login."
}
```

---

#### Revoke All Devices

```
DELETE /api/admin/users/:userId/devices
```

Deletes ALL WebAuthn credentials and session keys for a user.

**Response:**
```json
{
  "message": "All devices revoked (3 credentials removed). User must re-register on next login."
}
```

---

### Audit Logs

#### Get Audit Logs

```
GET /api/admin/audit-logs
```

**Response:**
```json
{
  "logs": [
    {
      "_id": "...",
      "userId": { "email": "admin@bank.local", "role": "admin" },
      "action": "login",
      "timestamp": "2026-05-10T10:30:00.000Z"
    }
  ]
}
```

**Tracked Actions:** `login`, `logout`, `oauth_authorize`, `webauthn_login`, `webauthn_register`

---

## Banking Service API

> All banking endpoints go through the centralized auth verification, which requires a valid JWT + ECDSA request signature.

### Health Check

```
GET /health
```

### Accounts

#### List Accounts

```
GET /api/banking/accounts
Authorization: Bearer <accessToken>
X-Signature: <signature>
X-Timestamp: <timestamp>
```

**Required Permission:** `READ_ACCOUNT`

**Response:**
```json
{
  "accounts": [
    {
      "_id": "...",
      "accountNumber": "1234567890",
      "ownerName": "John Doe",
      "balance": 5000,
      "currency": "USD",
      "type": "CHECKING"
    }
  ]
}
```

---

#### Create Account

```
POST /api/banking/account
Authorization: Bearer <accessToken>
X-Signature: <signature>
X-Timestamp: <timestamp>
Content-Type: application/json
```

**Required Permission:** `CREATE_ACCOUNT`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ownerName` | Body | ✅ | Account holder name |
| `accountType` | Body | ❌ | `CHECKING`, `SAVINGS`, `LOAN`, or `BUSINESS` (default: `CHECKING`) |
| `initialDeposit` | Body | ❌ | Starting balance (default: `0`) |

**Response (201):**
```json
{
  "message": "Account created successfully",
  "account": {
    "accountNumber": "1234567890",
    "ownerName": "John Doe",
    "balance": 1000,
    "type": "CHECKING"
  }
}
```

---

#### Delete Account

```
DELETE /api/banking/account/:accountNumber
Authorization: Bearer <accessToken>
X-Signature: <signature>
X-Timestamp: <timestamp>
```

**Required Permission:** `DELETE_ACCOUNT`

---

### Transactions

#### List Transactions

```
GET /api/banking/transactions/:accountNumber
Authorization: Bearer <accessToken>
X-Signature: <signature>
X-Timestamp: <timestamp>
```

**Required Permission:** `READ_TRANSACTION`

**Response:**
```json
{
  "transactions": [
    {
      "accountNumber": "1234567890",
      "amount": 500,
      "type": "CREDIT",
      "description": "",
      "date": "2026-05-10T10:00:00.000Z"
    }
  ]
}
```

---

#### Create Transaction

```
POST /api/banking/transactions
Authorization: Bearer <accessToken>
X-Signature: <signature>
X-Timestamp: <timestamp>
Content-Type: application/json
```

**Required Permission:** `CREATE_TRANSACTION`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountNumber` | Body | ✅ | Target account number |
| `amount` | Body | ✅ | Transaction amount |
| `type` | Body | ✅ | `CREDIT` or `DEBIT` |

**Response (201):**
```json
{
  "message": "Transaction successful",
  "transaction": { "accountNumber": "1234567890", "amount": 500, "type": "CREDIT" },
  "newBalance": 5500
}
```

---

### Loans

#### Process Loan

```
POST /api/banking/loan
Authorization: Bearer <accessToken>
X-Signature: <signature>
X-Timestamp: <timestamp>
Content-Type: application/json
```

**Required Permission:** `CREATE_LOAN_TRANSACTION`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountNumber` | Body | ✅ | Target account |
| `expectedAmount` | Body | ✅ | Loan amount to disburse |

---

## Device Service API

### Device Check

```
POST /api/devices/check
Content-Type: application/json
```

Check if a device is recognized and trusted.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User ID |
| `deviceId` | Body | ✅ | Device identifier |

**Responses:**
```json
{ "success": true, "trusted": true, "device": { ... } }
{ "success": false, "code": "DEVICE_UNRECOGNIZED" }
{ "success": false, "code": "DEVICE_UNRECOGNIZED", "isFirstLogin": true }
{ "success": false, "code": "DEVICE_EXPIRED" }
```

---

### OTP Flow

#### Request OTP

```
POST /api/devices/otp/request
Content-Type: application/json
```

Generates a 6-digit OTP and sends it to the user's email.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User ID |
| `deviceId` | Body | ✅ | Device identifier |
| `deviceName` | Body | ❌ | Human-readable device name |

---

#### Verify OTP

```
POST /api/devices/otp/verify
Content-Type: application/json
```

Verifies the OTP and creates a 5-hour temporary device session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | Body | ✅ | User ID |
| `deviceId` | Body | ✅ | Device identifier |
| `otp` | Body | ✅ | 6-digit OTP |

---

### Admin Device Operations

#### List All Devices

```
GET /api/devices
```

Returns all devices with populated user info.

---

#### Approve Device

```
PATCH /api/devices/:id/approve
```

Marks a device as trusted and removes the expiration (permanent trust).

---

#### Revoke Device

```
PATCH /api/devices/:id/revoke
```

Deletes a device — user will need to re-verify on next login.

---

## Error Codes Reference

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `SESSION_KEY_REQUIRED` | 403 | No ECDSA session key found — user must re-authenticate |
| `SIGNATURE_INVALID` | 403 | ECDSA signature doesn't match the stored public key |
| `TIMESTAMP_EXPIRED` | 403 | Request timestamp is outside the ±30 second tolerance |
| `DEVICE_UNRECOGNIZED` | 403 | Device not registered for this user |
| `DEVICE_EXPIRED` | 403 | Temporary device session has expired |
| — | 401 | Token missing, expired, or invalid |
| — | 403 | Insufficient permissions or user blocked/disabled |
| — | 409 | Resource conflict (e.g., duplicate email) |
| — | 404 | Resource not found |

---

## Rate Limiting & Risk Scoring

While there's no explicit rate limiter middleware, the system implements **behavioral rate limiting** through risk scoring:

- Every failed permission check increases `riskScore` by `+10`
- Every failed OTP attempt increases `riskScore` by `+10`
- When `riskScore > 90`, the user is **automatically blocked** (`isBlocked = true`)
- Blocked users receive `403` on all endpoints
- Admins can manually adjust risk scores or unblock users via the admin API
