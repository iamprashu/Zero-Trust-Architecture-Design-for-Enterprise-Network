const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  deviceName: {
    type: String,
    default: 'Unknown Device'
  },
  isTrusted: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  // Salted SHA-256 hash of the User-Agent at device creation time.
  // Compared on every verify call to detect deviceId theft / replay from a different machine.
  deviceFingerprint: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Device || mongoose.model('Device', deviceSchema);
