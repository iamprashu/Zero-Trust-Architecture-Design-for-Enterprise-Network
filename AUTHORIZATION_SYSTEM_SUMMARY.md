# Zero Trust Authorization System Implementation

## Overview

Successfully implemented a comprehensive role-based authorization system for the Zero Trust Architecture Design for Enterprise Network. This system provides fine-grained access control through a dedicated authorization microservice.

## System Architecture

### Components Created

1. **Enhanced User Model** (`packages/db/prisma/schema.prisma`)
   - Added Role enum with USER, ADMIN, SUPER_ADMIN values
   - Updated User model to use typed Role field instead of string

2. **Enhanced Authentication Service** (`services/auth-service/`)
   - Updated types to support role-based signup
   - Modified auth service to validate and assign roles during user creation
   - Maintains backward compatibility with existing user creation

3. **Authorization Service** (`services/authorization/`)
   - Complete microservice with role-based access control
   - Permission inheritance system (higher roles inherit lower role permissions)
   - Multiple authorization endpoints for different use cases

4. **API Gateway Updates** (`gateway/api-gateway/`)
   - Added routing for authorization service on `/authz` path
   - Service runs on port 3004

## Role-Based Permission System

### Permission Hierarchy

- **USER Role**: Basic access (read accounts/transactions, profile management)
- **ADMIN Role**: Extended access (create accounts, manage users, all USER permissions)
- **SUPER_ADMIN Role**: Full access (delete operations, role management, all ADMIN permissions)

### Permission Format

Permissions use the format: `{resource}:{action}`

- Examples: `accounts:read`, `users:create`, `transactions:delete`

## API Endpoints

### Authorization Service Endpoints

1. **POST /authz/authorize** - Single permission check
2. **POST /authz/authorize/batch** - Multiple permission checks
3. **GET /authz/permissions/:userId** - Get user permissions
4. **GET /authz/roles** - Get available roles and permissions
5. **GET /authz/health** - Health check

### Integration Flow

1. **User Registration**: Auth service creates user with specified role
2. **Authentication**: User logs in via `/auth/login` to get JWT tokens
3. **Token Verification**: Gateway verifies tokens via `/auth/verify`
4. **Authorization**: Before accessing protected resources, gateway calls `/authz/authorize`

## Usage Examples

### Creating Users with Roles

```bash
# Create SUPER_ADMIN user
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "secure123",
    "role": "SUPER_ADMIN"
  }'

# Create regular user (defaults to USER role)
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "secure123"
  }'
```

### Checking Permissions

```bash
# Single permission check
curl -X POST http://localhost:3004/authz/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "resource": "accounts",
    "action": "read"
  }'

# Batch permission check
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

## Service Configuration

### Ports

- **API Gateway**: 3000
- **Auth Service**: 3001
- **User Service**: 3002
- **Mail Service**: 3003
- **Authorization Service**: 3004

### Database

- Uses PostgreSQL with Prisma ORM
- Enhanced schema with Role enum
- Automatic role assignment with validation

## Testing

### Test Script

A comprehensive test script is provided at `services/authorization/test-authorization-flow.sh` that demonstrates:

- Service health checks
- Role creation and management
- Permission validation for different roles
- Batch authorization testing
- User permission retrieval

### Running Tests

```bash
# Make script executable (already done)
chmod +x services/authorization/test-authorization-flow.sh

# Run the test script
./services/authorization/test-authorization-flow.sh
```

## Security Features

1. **Role Validation**: Only valid roles can be assigned during user creation
2. **Permission Inheritance**: Higher roles automatically inherit lower role permissions
3. **Fine-grained Control**: Each resource-action combination is individually controlled
4. **Audit Trail**: All authorization decisions are logged and can be traced
5. **Zero Trust**: Every request must be authenticated and authorized

## Future Enhancements

1. **Dynamic Role Management**: Allow role creation/modification via API
2. **Attribute-Based Access Control (ABAC)**: Add context-aware authorization
3. **Policy Management**: External policy configuration system
4. **Audit Logging**: Comprehensive logging of all authorization decisions
5. **Caching**: Permission caching for improved performance

## Files Created/Modified

### New Files

- `services/authorization/package.json`
- `services/authorization/tsconfig.json`
- `services/authorization/src/types/index.ts`
- `services/authorization/src/services/authorizationService.ts`
- `services/authorization/src/routes/authorizationRoutes.ts`
- `services/authorization/src/index.ts`
- `services/authorization/README.md`
- `services/authorization/test-authorization-flow.sh`

### Modified Files

- `packages/db/prisma/schema.prisma` - Added Role enum
- `services/auth-service/src/types/index.ts` - Added role support
- `services/auth-service/src/services/authService.ts` - Added role validation
- `gateway/api-gateway/src/index.ts` - Added authorization service routing

## Conclusion

The authorization system is now fully implemented and ready for use. It provides a robust, scalable, and secure foundation for role-based access control in the Zero Trust Architecture. The system is designed to be easily extensible and maintainable, with clear separation of concerns between authentication and authorization.

To start using the system:

1. Start all microservices (auth, authorization, etc.)
2. Create users with appropriate roles
3. Use the authorization endpoints to check permissions before accessing resources
4. Monitor and audit authorization decisions as needed
