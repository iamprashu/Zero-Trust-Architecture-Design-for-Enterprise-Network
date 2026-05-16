const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow system-level events (rate limiting, etc.)
  },
  action: {
    type: String,
    required: true
    // No enum constraint — allows flexible action types without schema migrations
  },
  // ── IP & Geo-Location Tracking ──────────────────────────────────────────
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  geoLocation: {
    country: { type: String, default: null },
    city: { type: String, default: null },
    region: { type: String, default: null },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null }
  },
  // ── Optional Metadata ───────────────────────────────────────────────────
  details: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // already have explicit timestamp
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
