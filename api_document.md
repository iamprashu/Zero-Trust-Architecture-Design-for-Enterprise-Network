# Auth Service In-Depth API Documentation

This document outlines all available endpoints, required request bodies, header specifications, and exact JSON response models. 

**Base URL**: `http://localhost:5000`

## 1. Global Concepts & Headers

### Authentication
Most endpoints require a Javascript Web Token (JWT) passed securely in the headers or inside your session cookies.
They expire exactly 15 minutes after issuance.
**Using Headers**: `Authorization: Bearer <accessToken>`
**Using Cookies**: Passed automatically via HttpOnly `accessToken` cookie.

### Standard Error Responses
Uncaught or standardized permission blocks return structured HTTP error codes:
- **`400 Bad Request`**: Missing body fields. Example: `{ "error": "Missing required field" }`
- **`401 Unauthorized`**: Bad or expired JWT token. Example: `{ "error": "Missing or invalid token" }`
- **`403 Forbidden`**: User account disabled/deleted, or RBAC Guard evaluated permissions mapping as insufficient. Example: `{ "authorised": false, "error": "Insufficient permissions" }`
- **`404 Not Found`**: The target entity (User/Mapping) could not be located in MongoDB.

---

## 2. Public / Authentication Endpoints

### 2.1 Server Health
**`GET /health`**
- **Description:** Basic readiness probe.
- **Headers:** None.
- **Success Response (200 OK):**
```json
{
  "status": "ok",
  "service": "auth-service"
}
```

### 2.2 User Login
**`POST /api/auth/login`**
- **Description:** Authenticates credentials and logs an Audit record.
- **Request Body (JSON):**
```json
{
  "email": "user@domain.com",       // Required (String)
  "password": "securepassword123"   // Required (String)
}
```
- **Success Response (200 OK):**
*Note: Also drops `accessToken` and `refreshToken` HttpOnly secure cookies to your browser.*
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1...",
  "refreshToken": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": "60d5ec...",
    "email": "user@domain.com",
    "role": "editor"
  }
}
```

### 2.3 User Logout
**`POST /api/auth/logout`**
- **Description:** Drops session tracking state, strips JWT cookies, and logs an Audit record.
- **Headers:** `Authorization: Bearer <accessToken>` OR valid cookie.
- **Request Body:** None
- **Success Response (200 OK):**
*Note: This strictly calls `res.clearCookie` on both tokens.*
```json
{
  "message": "Logout successful"
}
```

---

## 3. Central Gateway Verifier (For Microservices)

### 3.1 Verify Access
**`POST /api/auth/verify-access`**
- **Description:** Core permission resolver. External backends forward a user's JWT and the endpoint they want to access. This API checks the user's mapped Role, translates it into permissions, maps the endpoint using `ApiMapping`, and evaluates authorization dynamically.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
```json
{
  "endpoint": "/api/getTransaction"   // Required (String)
}
```
- **Success Response - Authorized (200 OK):**
```json
{
  "authorised": true
}
```
- **Denial / Failure Responses (400 / 401 / 403 / 500):**
```json
{
  "authorised": false,
  "error": "Insufficient permissions" // Will explain exactly why (Token invalid, User banned, Lacks permissions, etc)
}
```

---

## 4. Superadmin Management Endpoints

These endpoints leverage strict system-level middleware and **only** evaluate successfully if `req.user.role === 'superadmin'`.

### 4.1 Create User
**`POST /api/admin/create-user`**
- **Description:** Safely registers actors into the database. Hashes passwords autonomously natively using `bcryptjs`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
```json
{
  "email": "john@company.com",  // Required (String)
  "password": "mypassword",     // Required (String)
  "role": "marketing_team"      // Required (String)
}
```
- **Success Response (201 Created):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "65e231b...",
    "email": "john@company.com",
    "role": "marketing_team"
  }
}
```

### 4.2 Fetch All Users
**`GET /api/admin/users`**
- **Description:** Returns all registered users globally. Securely strips the `password` field from network transit.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Success Response (200 OK):**
```json
{
  "users": [
    {
      "_id": "65e231b...",
      "email": "john@company.com",
      "role": "marketing_team",
      "riskScore": 0,
      "disabled": false,
      "deleted": false,
      "createdAt": "2026-04-09T18:00:00.000Z",
      "updatedAt": "2026-04-09T18:00:00.000Z"
    }
  ]
}
```

---

## 5. Security & Risk Operations

These require permissions matched via dynamic `ApiMapping`. Superadmins bypass all configuration implicitly. 

### 5.1 Disable User Toggle
**`PATCH /api/admin/users/disable`**
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
```json
{
  "userId": "65e231b...", // Required (Mongo ID)
  "disabled": true        // Required (Boolean)
}
```
- **Success Response (200 OK):**
```json
{
  "message": "User disabled status set to true",
  "user": { /* Complete updated user object */ }
}
```

### 5.2 Delete User Toggle (Soft Delete)
**`PATCH /api/admin/users/delete`**
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
```json
{
  "userId": "65e231b...", // Required (Mongo ID)
  "deleted": true         // Required (Boolean)
}
```
- **Success Response (200 OK):**
```json
{
  "message": "User deleted status set to true",
  "user": { /* Complete updated user object */ }
}
```

### 5.3 Overwrite User Risk Score
**`PATCH /api/admin/users/risk`**
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
```json
{
  "userId": "65e231b...", // Required (Mongo ID)
  "riskScore": 85         // Required (Number)
}
```
- **Success Response (200 OK):**
```json
{
  "message": "Risk score updated",
  "user": { /* Complete updated user object with new riskScore */ }
}
```

### 5.4 Reassign User Role
**`PATCH /api/admin/users/:userId/role`**
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
```json
{
  "role": "finance_manager" // Required (String)
}
```
- **Success Response (200 OK):**
```json
{
  "message": "User role updated",
  "user": {
    "id": "65e231b...",
    "email": "user@domain.com",
    "role": "finance_manager"
  }
}
```

### 5.5 Fetch Audit Logs
**`GET /api/admin/audit-logs`**
- **Headers:** `Authorization: Bearer <accessToken>`
- **Success Response (200 OK):**
```json
{
  "logs": [
    {
      "_id": "61a123f...",
      "userId": {
        "_id": "65e231b...",
        "email": "user@domain.com",
        "role": "marketing_team"
      },
      "action": "login",
      "timestamp": "2026-04-09T18:05:00.000Z"
    }
  ]
}
```

---

## 6. RBAC Configuration State

### 6.1 Create / Register a System Role
**`POST /api/admin/roles`**
- **Description:** Constructs a hierarchal Role housing a subset of stringified permissions.
- **Request Body (JSON):**
```json
{
  "name": "finance_manager",           // Required (String)
  "permissions": ["ledger:read", "ledger:write"] // Array of Strings
}
```
- **Success Response (200 OK):**
```json
{
  "message": "Role created",
  "role": {
    "_id": "5f1a...",
    "name": "finance_manager",
    "permissions": ["ledger:read", "ledger:write"]
  }
}
```

### 6.2 Get All Roles
**`GET /api/admin/roles`**
- **Success Response (200 OK):**
```json
{
  "roles": [ /* Array of Role Objects */ ]
}
```

### 6.3 Update Role
**`PATCH /api/admin/roles/:id`**
- **Description:** Updates the name and/or permissions of an existing role. If the name is changed, it cascades seamlessly to all User records.
- **Request Body (JSON):**
```json
{
  "name": "senior_finance_manager", // Optional (String)
  "permissions": ["ledger:read"]    // Optional (Array of Strings)
  //this api needed readding of all roles again means reassigned array should be there
}
```
- **Success Response (200 OK):**
```json
{
  "message": "Role updated",
  "role": { /* Updated Role Object */ }
}
```

### 6.4 Delete Role
**`DELETE /api/admin/roles/:id`**
- **Description:** Deletes a role. Fails natively if users are currently attached to the role.
- **Success Response (200 OK):**
```json
{
  "message": "Role deleted successfully"
}
```

### 6.5 Create / Register Base Permissions
**`POST /api/admin/permissions`**
- **Description:** Mostly a semantic tracking DB for registering standard behaviors systemically.
- **Request Body (JSON):**
```json
{
  "name": "ledger:write",                 // Required (String)
  "description": "Edits finance tracking" // Optional (String)
}
```
- **Success Response (200 OK):**
```json
{
  "message": "Permission created",
  "permission": { /* Permission Object */ }
}
```

### 6.6 Get All Permissions
**`GET /api/admin/permissions`**
- **Success Response (200 OK):**
```json
{
  "permissions": [ /* Array of Permission Objects */ ]
}
```

### 6.7 Update Permission
**`PATCH /api/admin/permissions/:id`**
- **Description:** Changes permission name or description. Modifying the name automatically cascades to all existing Roles and ApiMappings.
- **Request Body (JSON):**
```json
{
  "name": "ledger:write_all",       // Optional (String)
  "description": "Full edit access" // Optional (String)
}
```
- **Success Response (200 OK):**
```json
{
  "message": "Permission updated",
  "permission": { /* Updated permission object */ }
}
```

### 6.8 Delete Permission
**`DELETE /api/admin/permissions/:id`**
- **Description:** Hard deletes a permission, pulling it from all corresponding Roles and Mappings automatically.
- **Success Response (200 OK):**
```json
{
  "message": "Permission deleted successfully and removed from all dependent collections"
}
```

### 6.9 Create API Mapping (Attach Permissions to Routes)
**`POST /api/admin/mappings`**
- **Description:** Explicitly wires a URL Endpoint configuration setting against required RBAC tokens.
- **Request Body (JSON):**
```json
{
  "route": "/api/admin/users/disable",  // Required (String target route)
  "requiredPermissions": ["user:manage"] // Permissions array
}
```
- **Success Response (200 OK):**
```json
{
  "message": "API Mapping stored",
  "mapping": {
    "_id": "5fa... ",
    "route": "/api/admin/users/disable",
    "requiredPermissions": ["user:manage"]
  }
}
```

### 6.10 Get Mappings Configuration
**`GET /api/admin/mappings`**
- **Success Response (200 OK):**
```json
{
  "mappings": [ /* Array of ApiMapping objects */ ]
}
```
