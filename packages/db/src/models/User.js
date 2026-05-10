const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String, // Matches the name field inside Role schema
    required: true
  },
  riskScore: {
    type: Number,
    default: 0
  },
  disabled: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  },
  refreshToken: {
    type: String,
    default: null
  },
  authenticatorSecret: {
    type: String,
    default: null
  },
  isAuthenticatorSetup: {
    type: Boolean,
    default: false
  },
  // ── Security Lockout (admin-gated) ──────────────────────────────────────
  // Set to true automatically when suspicious device activity is detected.
  // Can ONLY be cleared by an admin via POST /api/admin/users/:id/unlock-security.
  // TOTP secret is NEVER touched by lockout/unlock — user's authenticator app stays valid.
  securityLockout: {
    type: Boolean,
    default: false
  },
  // Counts consecutive UA fingerprint mismatches on OTP sessions.
  // Resets to 0 on a successful fingerprint match or after admin unlock.
  // Triggers lockout when it reaches 3.
  securityIncidentCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
