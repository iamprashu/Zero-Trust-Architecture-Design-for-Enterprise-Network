const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  // ── Token Rotation (Theft Detection) ────────────────────────────────────
  // All tokens from a single login session share the same family ID.
  // When a token is refreshed, the old one is revoked and `replacedBy` points
  // to the new token. If a revoked token is reused (replay attack), ALL tokens
  // in the family are revoked and the user's session is killed.
  family: {
    type: String,
    required: true,
    index: true
  },
  replacedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Auto-delete expired refresh tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
