const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  permissions: {
    type: [String], // Array of permission strings e.g., 'app:read', 'user:write'
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
