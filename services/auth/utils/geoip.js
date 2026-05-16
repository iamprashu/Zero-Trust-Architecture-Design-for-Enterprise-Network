/**
 * Geo-IP Resolution Utility
 * 
 * Resolves an IP address to geographic location using the free ip-api.com service.
 * - No API key required
 * - 45 requests/minute rate limit (more than enough for auth events)
 * - Falls back gracefully to { country: 'Unknown' } on failure
 * 
 * Usage:
 *   const { resolveGeo } = require('../utils/geoip');
 *   const geo = await resolveGeo('203.0.113.1');
 *   // => { country: 'India', city: 'Mumbai', region: 'Maharashtra', lat: 19.07, lon: 72.87 }
 */

const http = require('http');

// In-memory cache to avoid redundant lookups (IP → geo, TTL 1 hour)
const geoCache = new Map();
const GEO_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cleanup stale cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of geoCache) {
    if (now - val.cachedAt > GEO_CACHE_TTL) geoCache.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * Extract the real client IP from request headers.
 * Handles: X-Forwarded-For (nginx), X-Real-IP, and falls back to req.ip.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be comma-separated: client, proxy1, proxy2
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Resolve an IP address to geographic location.
 * Returns: { country, city, region, lat, lon }
 * Non-blocking — never throws, returns defaults on failure.
 */
async function resolveGeo(ip) {
  const defaultGeo = { country: null, city: null, region: null, lat: null, lon: null };

  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { ...defaultGeo, country: 'Local' };
  }

  // Check cache first
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
    return cached.geo;
  }

  try {
    const geo = await new Promise((resolve, reject) => {
      const req = http.get(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon`, {
        timeout: 3000 // 3 second timeout — don't block auth flow
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.status === 'success') {
              resolve({
                country: parsed.country || null,
                city: parsed.city || null,
                region: parsed.regionName || null,
                lat: parsed.lat || null,
                lon: parsed.lon || null
              });
            } else {
              resolve(defaultGeo);
            }
          } catch {
            resolve(defaultGeo);
          }
        });
      });
      req.on('error', () => resolve(defaultGeo));
      req.on('timeout', () => { req.destroy(); resolve(defaultGeo); });
    });

    // Cache the result
    geoCache.set(ip, { geo, cachedAt: Date.now() });
    return geo;
  } catch {
    return defaultGeo;
  }
}

/**
 * Create an audit log entry with IP and geo-location.
 * Resolves geo asynchronously but doesn't block — saves the log immediately
 * with IP, then updates with geo data when resolved.
 */
async function createAuditLogWithGeo(AuditLog, { userId, action, req, details }) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers?.['user-agent'] || null;

  // Create the log entry immediately with IP
  const logEntry = await AuditLog.create({
    userId: userId || undefined,
    action,
    ipAddress,
    userAgent,
    details: details || null,
    geoLocation: { country: null, city: null, region: null, lat: null, lon: null }
  });

  // Resolve geo in background (don't await — fire and forget)
  resolveGeo(ipAddress).then(geo => {
    AuditLog.updateOne({ _id: logEntry._id }, { geoLocation: geo }).catch(() => {});
  });

  return logEntry;
}

module.exports = { getClientIp, resolveGeo, createAuditLogWithGeo };
