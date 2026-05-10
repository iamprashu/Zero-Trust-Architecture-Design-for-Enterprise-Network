const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      'login', 'logout', 'oauth_authorize', 'webauthn_login', 'webauthn_register',
      'security_incident',    // OTP device UA fingerprint mismatch detected
      'admin_security_unlock' // Admin cleared a user's security lockout
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // already have explicit timestamp
});

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
