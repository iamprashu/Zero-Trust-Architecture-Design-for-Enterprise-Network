const { User, AuditLog, Role, Permission, ApiMapping, WebAuthnCredential, SessionKey } = require('@repo/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Helpers for checking if user is superadmin
const isSuperAdmin = (req) => req.user && req.user.role === 'superadmin';

// ------------------------
// User Management
// ------------------------
exports.createUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Quick validation
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      email,
      password: hashedPassword,
      role
    });

    res.status(201).json({ message: 'User created successfully', user: { id: newUser._id, email: newUser.email, role: newUser.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.disableUser = async (req, res) => {
  try {
    const { userId, disabled } = req.body;
    const user = await User.findByIdAndUpdate(userId, { disabled }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User disabled status set to ${disabled}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role) {
       return res.status(400).json({ error: 'Role is required' });
    }

    if (role !== 'superadmin') {
      const roleExists = await Role.findOne({ name: role });
      if (!roleExists) {
        return res.status(400).json({ error: 'Provided role does not exist' });
      }
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User role updated', user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId, deleted } = req.body;
    const user = await User.findByIdAndUpdate(userId, { deleted }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User deleted status set to ${deleted}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRiskScore = async (req, res) => {
  try {
    const { userId, riskScore } = req.body;
    
    const updateData = { riskScore, isBlocked: riskScore > 90 };
    
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Risk score updated', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------
// Audit Logs
// ------------------------
exports.getAuditLogs = async (req, res) => {
  try {
    // Basic implementation; would add pagination in real scenario
    const logs = await AuditLog.find().populate('userId', 'email role').sort({ timestamp: -1 });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------
// Roles & Permissions
// ------------------------
exports.createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const role = await Role.create({ name, permissions });
    res.json({ message: 'Role created', role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    
    const roleToUpdate = await Role.findById(id);
    if (!roleToUpdate) return res.status(404).json({ error: 'Role not found' });
    if (roleToUpdate.name === 'superadmin') return res.status(403).json({ error: 'Cannot modify superadmin role directly' });

    let oldRoleName = roleToUpdate.name;

    if (name) roleToUpdate.name = name;
    if (permissions) roleToUpdate.permissions = permissions;

    await roleToUpdate.save();

    // If role name changed, cascade to User models
    if (name && oldRoleName !== name) {
      await User.updateMany({ role: oldRoleName }, { $set: { role: name } });
    }

    res.json({ message: 'Role updated', role: roleToUpdate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const roleToDelete = await Role.findById(id);
    if (!roleToDelete) return res.status(404).json({ error: 'Role not found' });
    if (roleToDelete.name === 'superadmin') return res.status(403).json({ error: 'Cannot delete superadmin role' });

    // Check if any users have this role
    const usersWithRole = await User.countDocuments({ role: roleToDelete.name });
    if (usersWithRole > 0) {
      return res.status(400).json({ error: `Cannot delete role. It is currently assigned to ${usersWithRole} user(s). Reassign them first.` });
    }

    await Role.findByIdAndDelete(id);
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPermission = async (req, res) => {
  try {
    const { name, description } = req.body;
    const permission = await Permission.create({ name, description });
    res.json({ message: 'Permission created', permission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const permission = await Permission.findById(id);
    if (!permission) return res.status(404).json({ error: 'Permission not found' });

    const oldName = permission.name;

    if (name) permission.name = name;
    if (description !== undefined) permission.description = description;

    await permission.save();

    // Cascade name change globally
    if (name && name !== oldName) {
      await Role.updateMany(
        { permissions: oldName },
        { $set: { "permissions.$": name } }
      );
      await ApiMapping.updateMany(
        { requiredPermissions: oldName },
        { $set: { "requiredPermissions.$": name } }
      );
    }

    res.json({ message: 'Permission updated', permission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await Permission.findById(id);
    if (!permission) return res.status(404).json({ error: 'Permission not found' });

    const permName = permission.name;

    await Permission.findByIdAndDelete(id);

    // Cascade deletion
    await Role.updateMany(
      { permissions: permName },
      { $pull: { permissions: permName } }
    );
    await ApiMapping.updateMany(
      { requiredPermissions: permName },
      { $pull: { requiredPermissions: permName } }
    );

    res.json({ message: 'Permission deleted successfully and removed from all dependent collections' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------
// API Mappings
// ------------------------
exports.createApiMapping = async (req, res) => {
  try {
    const { route, requiredPermissions } = req.body;
    const mapping = await ApiMapping.findOneAndUpdate(
      { route },
      { requiredPermissions },
      { new: true, upsert: true }
    );
    res.json({ message: 'API Mapping stored', mapping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApiMappings = async (req, res) => {
  try {
    const mappings = await ApiMapping.find();
    res.json({ mappings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------
// Device Management (WebAuthn)
// ------------------------

// List all WebAuthn devices for a user
exports.getUserDevices = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const devices = await WebAuthnCredential.find({ userId }, '-publicKey');
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Revoke (delete) a specific WebAuthn device
exports.revokeDevice = async (req, res) => {
  try {
    const { credentialId } = req.params;
    const credential = await WebAuthnCredential.findById(credentialId);
    if (!credential) return res.status(404).json({ error: 'Device credential not found' });

    const userId = credential.userId;

    // Delete the credential
    await WebAuthnCredential.findByIdAndDelete(credentialId);

    // Also invalidate all session keys for this user (force re-auth)
    await SessionKey.deleteMany({ userId });

    res.json({ message: 'Device revoked. User will need to re-register or use OTP on next login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Revoke ALL devices for a user
exports.revokeAllDevices = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const deletedCount = await WebAuthnCredential.deleteMany({ userId });
    await SessionKey.deleteMany({ userId });

    res.json({
      message: `All devices revoked (${deletedCount.deletedCount} credentials removed). User must re-register on next login.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
