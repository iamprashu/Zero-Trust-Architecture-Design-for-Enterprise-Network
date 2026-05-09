const mongoose = require('mongoose');

const sessionKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publicKeyJWK: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Auto-delete expired session keys
sessionKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast lookup by userId
sessionKeySchema.index({ userId: 1 });

module.exports = mongoose.models.SessionKey || mongoose.model('SessionKey', sessionKeySchema);
