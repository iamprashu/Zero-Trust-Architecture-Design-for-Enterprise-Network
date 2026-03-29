# Authorization Service

Authorization microservice for the Zero Trust Architecture Design for Enterprise Network.

## Overview

This service handles role-based access control (RBAC) for the enterprise network. It validates user permissions against requested resources and actions.

## Features

- **Role-Based Access Control (RBAC)**: Supports USER, ADMIN, and SUPER_ADMIN roles
- **Permission Inheritance**: Higher roles inherit permissions from lower roles
- **Single Permission Check**: Validate one permission at a time
- **Batch Permission Check**: Validate multiple permissions in one request
- **Permission Management**: Retrieve user permissions and available roles

## Roles and Permissions

### USER Role

- `accounts:read` - Read account information
- `transactions:read` - Read transaction history
- `profile:read` - Read user profile
- `profile:update` - Update user profile

### ADMIN Role

- All USER permissions
- `accounts:create` - Create new accounts
- `accounts:update` - Update account information
- `transactions:create` - Create transactions
- `users:read` - Read user information
- `users:create` - Create new users

### SUPER_ADMIN Role

- All ADMIN permissions
- `accounts:delete` - Delete accounts
- `transactions:delete` - Delete transactions
- `users:update` - Update user information
- `users:delete` - Delete users
- `roles:read` - Read role information
- `roles:update` - Update role assignments

## API Endpoints

### POST /authz/authorize

Check if a user has permission for a specific resource and action.

**Request Body:**

```json
{
  "userId": "string",
  "resource": "string",
  "action": "string"
}
```

**Response:**

```json
{
  "authorized": boolean,
  "message": "string",
  "user": {
    "id": "string",
    "email": "string",
    "role": "string"
  },
  "permissions": ["string"]
}
```

### POST /authz/authorize/batch

Check multiple permissions for a user in a single request.

**Request Body:**

```json
{
  "userId": "string",
  "checks": [
    {
      "resource": "string",
      "action": "string"
    }
  ]
}
```

**Response:**

```json
[
  {
    "authorized": boolean,
    "message": "string",
    "user": {
      "id": "string",
      "email": "string",
      "role": "string"
    },
    "permissions": ["string"]
  }
]
```

### GET /authz/permissions/:userId

Retrieve all permissions for a specific user.

**Response:**

```json
{
  "user": {
    "id": "string",
    "email": "string",
    "role": "string"
  },
  "permissions": ["string"],
  "message": "string"
}
```

### GET /authz/roles

Get all available roles and their permissions.

**Response:**

```json
{
  "roles": [
    {
      "role": "string",
      "permissions": ["string"]
    }
  ],
  "message": "string"
}
```

### GET /authz/health

Health check endpoint.

**Response:**

```json
{
  "status": "Authorization Service Running",
  "timestamp": "string"
}
```

## Usage Example

```bash
# Check if user can read accounts
curl -X POST http://localhost:3004/authz/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "resource": "accounts",
    "action": "read"
  }'

# Check multiple permissions
curl -X POST http://localhost:3004/authz/authorize/batch \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "checks": [
      {"resource": "accounts", "action": "read"},
      {"resource": "transactions", "action": "create"}
    ]
  }'
```

## Integration with Auth Service

The authorization service works with the authentication service to provide complete access control:

1. **Authentication**: User logs in via `/auth/login` to get JWT tokens
2. **Token Verification**: Gateway verifies tokens via `/auth/verify`
3. **Authorization**: Before accessing protected resources, gateway calls `/authz/authorize` to check permissions

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `PORT`: Service port (default: 3004)
- `DATABASE_URL`: PostgreSQL connection string
