# Auth Service

A production-ready authentication microservice built with TypeScript and Express.js. This service handles user registration, login, and JWT token management with both access and refresh tokens.

## 🚀 Features

- **User Registration**: Create new user accounts with secure password hashing
- **User Login**: Authenticate users with email and password
- **JWT Token Management**: Issue both access tokens (15 minutes) and refresh tokens (7 days)
- **Token Verification**: Validate access tokens and check user authentication
- **Token Refresh**: Generate new access tokens using refresh tokens
- **TypeScript**: Full type safety and excellent developer experience
- **Production Architecture**: Clean separation of concerns with middleware, services, and routes

## 📁 Project Structure

```
src/
├── index.ts              # Main application entry point
├── types/
│   ├── index.ts          # TypeScript interfaces for all data structures
│   └── express.d.ts      # Express type extensions
├── middleware/
│   └── authMiddleware.ts # Authentication middleware for protected routes
├── services/
│   └── authService.ts    # Business logic and data operations
└── routes/
    └── authRoutes.ts     # HTTP route handlers
```

## ⚙️ Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=3001
JWT_ACCESS_SECRET=your-super-secret-access-token-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-change-this-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
DATABASE_URL='postgresql://neondb_owner:@ep-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_b'
```

### Environment Variables Explained

- **NODE_ENV**: Application environment (development/production)
- **PORT**: Port number for the service (default: 3001)
- **JWT_ACCESS_SECRET**: Secret key for signing access tokens (⚠️ **Keep this secure!**)
- **JWT_REFRESH_SECRET**: Secret key for signing refresh tokens (⚠️ **Keep this secure!**)
- **JWT_ACCESS_EXPIRES_IN**: Access token expiration time (default: 15 minutes)
- **JWT_REFRESH_EXPIRES_IN**: Refresh token expiration time (default: 7 days)
- **BCRYPT_ROUNDS**: Number of salt rounds for password hashing (default: 12)

## 🌐 API Endpoints

### 1. User Registration

**Endpoint**: `POST /api/users`

**Purpose**: Create a new user account

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (Success - 201):

```json
{
  "message": "User created successfully",
  "user": {
    "id": "user-uuid-here",
    "email": "user@example.com"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response** (Error - 400):

```json
{
  "error": "User already exists"
}
```

### 2. User Login

**Endpoint**: `POST /api/auth/login`

**Purpose**: Authenticate a user and return tokens

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (Success - 200):

```json
{
  "message": "Login successful",
  "user": {
    "id": "user-uuid-here",
    "email": "user@example.com"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response** (Error - 401):

```json
{
  "error": "Invalid credentials"
}
```

### 3. Token Verification

**Endpoint**: `POST /api/auth/verify`

**Purpose**: Verify an access token and get user information

**Request Body**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (Success - 200):

```json
{
  "message": "Token is valid",
  "user": {
    "id": "user-uuid-here",
    "email": "user@example.com"
  },
  "tokenData": {
    "userId": "user-uuid-here",
    "type": "access",
    "expiresIn": 1648234567
  }
}
```

**Response** (Error - 401):

```json
{
  "error": "Invalid token"
}
```

### 4. Token Refresh

**Endpoint**: `POST /api/auth/refresh`

**Purpose**: Generate a new access token using a refresh token

**Request Body**:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (Success - 200):

```json
{
  "message": "Token refreshed successfully",
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response** (Error - 401):

```json
{
  "error": "Invalid refresh token"
}
```

## 🔧 How to Use the APIs

### Using cURL

**Register a new user**:

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "mypassword123"
  }'
```

**Login**:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "mypassword123"
  }'
```

**Verify a token**:

```bash
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Refresh token**:

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

## 🛡️ Security Features

- **Password Hashing**: All passwords are securely hashed using bcryptjs with 12 salt rounds
- **JWT Tokens**: Secure token-based authentication with separate access and refresh tokens
- **Token Expiration**: Short-lived access tokens (15 minutes) reduce security risks
- **Token Type Validation**: Separate validation for access and refresh tokens
- **Environment Secrets**: Sensitive data stored in environment variables

## 🚀 Running the Service

1. **Install dependencies**:

   ```bash
   cd services/auth-service
   pnpm install
   ```

2. **Start the development server**:

   ```bash
   pnpm run dev
   ```

3. **Access the service**:
   The service will be available at `http://localhost:3001`

## 📝 Notes

- The service requires a database connection (PostgreSQL) to function properly
- All API responses include proper HTTP status codes
- Error handling is comprehensive with meaningful error messages
- The service follows RESTful API principles
- TypeScript provides excellent type safety and developer experience

## 🔗 Integration

This auth service is designed to work as part of a microservices architecture. Other services can:

- Use the `/api/auth/verify` endpoint to validate tokens
- Implement the `authenticateToken` middleware for protected routes
- Use the returned user information for authorization decisions
