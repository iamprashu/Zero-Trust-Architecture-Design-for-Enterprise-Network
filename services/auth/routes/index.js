const express = require('express');
const router = express.Router();

const { verifyJwt, rbacGuard, superAdminGuard } = require('../middleware/authMiddleware');
const authController = require('../controllers/auth');
const adminController = require('../controllers/admin');

// ----------------------
// Auth Routes
// ----------------------
router.get('/login', authController.renderLogin);
router.post('/auth/login', authController.login); // kept for legacy
router.post('/auth/authorize', authController.authorize);
router.post('/auth/authorize-otp', authController.authorizeOtp);
router.post('/auth/token', authController.token);
router.post('/auth/verify', authController.verify);
router.post('/auth/verify-access', authController.verifyAccess);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', verifyJwt, authController.logout);

// ----------------------
// Admin Routes (protected)
// ----------------------
// Ensure user is valid and User has required permissions for the endpoint.
router.use('/admin', verifyJwt);

// User Management (Superadmin Only for Creation)
router.post('/admin/create-user', superAdminGuard, adminController.createUser);
router.get('/admin/users', superAdminGuard, adminController.getUsers);

router.patch('/admin/users/disable', rbacGuard, adminController.disableUser);
router.patch('/admin/users/delete', rbacGuard, adminController.deleteUser);
router.patch('/admin/users/risk', rbacGuard, adminController.updateRiskScore);
router.patch('/admin/users/:userId/role', rbacGuard, adminController.updateUserRole);

// Audit Logs
router.get('/admin/audit-logs', rbacGuard, adminController.getAuditLogs);

// Role & Permission Management
router.post('/admin/roles', rbacGuard, adminController.createRole);
router.get('/admin/roles', rbacGuard, adminController.getRoles);
router.patch('/admin/roles/:id', rbacGuard, adminController.updateRole);
router.delete('/admin/roles/:id', rbacGuard, adminController.deleteRole);

router.post('/admin/permissions', rbacGuard, adminController.createPermission);
router.get('/admin/permissions', rbacGuard, adminController.getPermissions);
router.patch('/admin/permissions/:id', rbacGuard, adminController.updatePermission);
router.delete('/admin/permissions/:id', rbacGuard, adminController.deletePermission);

// API Mapping Management
router.post('/admin/mappings', rbacGuard, adminController.createApiMapping);
router.get('/admin/mappings', rbacGuard, adminController.getApiMappings);


module.exports = router;
