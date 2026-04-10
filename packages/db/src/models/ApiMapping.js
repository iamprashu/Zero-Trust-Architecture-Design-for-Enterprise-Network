const mongoose = require('mongoose');

const apiMappingSchema = new mongoose.Schema({
  route: {
    type: String, // e.g. "/api/account/list"
    required: true,
    unique: true,
    trim: true
  },
  requiredPermissions: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ApiMapping || mongoose.model('ApiMapping', apiMappingSchema);
