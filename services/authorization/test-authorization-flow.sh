#!/bin/bash

# Zero Trust Authorization Flow Test Script
# This script demonstrates the complete authorization flow

echo "=== Zero Trust Authorization Flow Test ==="
echo

# Configuration
AUTH_SERVICE="http://localhost:3001"
AUTHZ_SERVICE="http://localhost:3004"
GATEWAY="http://localhost:3000"

echo "Testing Authorization Service Endpoints..."
echo

# Test 1: Health Check
echo "1. Testing Authorization Service Health Check"
curl -s "$AUTHZ_SERVICE/health" | jq '.'
echo

# Test 2: Get Available Roles
echo "2. Getting Available Roles"
curl -s "$AUTHZ_SERVICE/authz/roles" | jq '.'
echo

# Test 3: Create Users with Different Roles (via Auth Service)
echo "3. Creating Users with Different Roles"

# Create SUPER_ADMIN user
echo "   Creating SUPER_ADMIN user..."
curl -s -X POST "$AUTH_SERVICE/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@example.com",
    "password": "password123",
    "role": "SUPER_ADMIN"
  }' | jq '.'
echo

# Create ADMIN user
echo "   Creating ADMIN user..."
curl -s -X POST "$AUTH_SERVICE/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com", 
    "password": "password123",
    "role": "ADMIN"
  }' | jq '.'
echo

# Create USER
echo "   Creating USER..."
curl -s -X POST "$AUTH_SERVICE/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' | jq '.'
echo

# Note: In a real scenario, you would extract the userId from the responses above
# For this test, we'll use placeholder user IDs
SUPER_ADMIN_ID="placeholder-super-admin-id"
ADMIN_ID="placeholder-admin-id"
USER_ID="placeholder-user-id"

echo "4. Testing Authorization Checks"
echo

# Test USER permissions
echo "   Testing USER permissions..."
echo "   - Can USER read accounts? (should be true)"
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "resource": "accounts",
    "action": "read"
  }' | jq '.'
echo

echo "   - Can USER create accounts? (should be false)"
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "resource": "accounts",
    "action": "create"
  }' | jq '.'
echo

# Test ADMIN permissions
echo "   Testing ADMIN permissions..."
echo "   - Can ADMIN create accounts? (should be true)"
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$ADMIN_ID'",
    "resource": "accounts",
    "action": "create"
  }' | jq '.'
echo

echo "   - Can ADMIN delete accounts? (should be false)"
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$ADMIN_ID'",
    "resource": "accounts",
    "action": "delete"
  }' | jq '.'
echo

# Test SUPER_ADMIN permissions
echo "   Testing SUPER_ADMIN permissions..."
echo "   - Can SUPER_ADMIN delete accounts? (should be true)"
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$SUPER_ADMIN_ID'",
    "resource": "accounts",
    "action": "delete"
  }' | jq '.'
echo

echo "   - Can SUPER_ADMIN update users? (should be true)"
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$SUPER_ADMIN_ID'",
    "resource": "users",
    "action": "update"
  }' | jq '.'
echo

# Test Batch Authorization
echo "5. Testing Batch Authorization"
echo "   Testing multiple permissions for ADMIN user..."
curl -s -X POST "$AUTHZ_SERVICE/authz/authorize/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$ADMIN_ID'",
    "checks": [
      {"resource": "accounts", "action": "read"},
      {"resource": "accounts", "action": "create"},
      {"resource": "accounts", "action": "delete"},
      {"resource": "users", "action": "read"},
      {"resource": "users", "action": "create"}
    ]
  }' | jq '.'
echo

# Test User Permissions Retrieval
echo "6. Testing User Permissions Retrieval"
echo "   Getting permissions for ADMIN user..."
curl -s "$AUTHZ_SERVICE/authz/permissions/$ADMIN_ID" | jq '.'
echo

echo "=== Test Complete ==="
echo
echo "Note: To run this script successfully, you need:"
echo "1. Start the Auth Service on port 3001"
echo "2. Start the Authorization Service on port 3004"
echo "3. Install jq for JSON formatting: sudo apt-get install jq"
echo "4. Replace placeholder user IDs with actual IDs from user creation responses"