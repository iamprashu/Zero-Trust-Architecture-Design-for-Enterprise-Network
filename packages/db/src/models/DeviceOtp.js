const mongoose = require('mongoose');

const deviceOtpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  deviceName: {
    type: String,
    default: 'Unknown Device'
  },
  otp: {
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

module.exports = mongoose.models.DeviceOtp || mongoose.model('DeviceOtp', deviceOtpSchema);
