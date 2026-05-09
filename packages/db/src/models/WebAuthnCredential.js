const mongoose = require('mongoose');

const webAuthnCredentialSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  credentialId: {
    type: String,
    required: true,
    unique: true
  },
  publicKey: {
    type: String,
    required: true
  },
  counter: {
    type: Number,
    default: 0
  },
  deviceName: {
    type: String,
    default: 'Unknown Device'
  },
  transports: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Index for fast lookups during authentication
webAuthnCredentialSchema.index({ userId: 1 });

module.exports = mongoose.models.WebAuthnCredential || mongoose.model('WebAuthnCredential', webAuthnCredentialSchema);
