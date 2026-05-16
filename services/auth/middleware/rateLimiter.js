/**
 * In-Memory Rate Limiter Middleware
 * 
 * No Redis required — uses a Map with automatic TTL cleanup.
 * Each client is identified by IP address.
 * 
 * Usage:
 *   const { createRateLimiter } = require('../middleware/rateLimiter');
 *   router.post('/auth/authorize', createRateLimiter({ maxAttempts: 5, windowMs: 60000 }), controller);
 */

const { getClientIp } = require('../utils/geoip');

// Stores: Map<key, { count, resetTime }>
const rateLimitStore = new Map();

// Cleanup expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (now > val.resetTime) rateLimitStore.delete(key);
  }
}, 2 * 60 * 1000);

/**
 * Create a rate limiter middleware with configurable limits.
 * @param {Object} options
 * @param {number} options.maxAttempts - Max requests per window (default: 5)
 * @param {number} options.windowMs - Time window in ms (default: 60000 = 1 min)
 * @param {string} [options.keyPrefix] - Optional prefix to separate different endpoints
 * @param {string} [options.message] - Custom error message
 */
function createRateLimiter({
  maxAttempts = 5,
  windowMs = 60000,
  keyPrefix = '',
  message = 'Too many requests. Please try again later.'
} = {}) {
  return (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // First request or window expired — start fresh
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;

    if (record.count > maxAttempts) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message,
        retryAfter,
        code: 'RATE_LIMITED'
      });
    }

    return next();
  };
}

/**
 * Pre-configured rate limiters for common endpoints
 */
const loginLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 1000,    // 1 minute
  keyPrefix: 'login',
  message: 'Too many login attempts. Please wait 1 minute before trying again.'
});

const otpLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 1000,    // 1 minute
  keyPrefix: 'otp',
  message: 'Too many OTP attempts. Please wait 1 minute before trying again.'
});

const otpRequestLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 2 * 60 * 1000, // 2 minutes
  keyPrefix: 'otp-req',
  message: 'Too many OTP requests. Please wait 2 minutes before requesting again.'
});

const refreshLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 1000,    // 1 minute
  keyPrefix: 'refresh',
  message: 'Too many refresh attempts. Please wait before trying again.'
});

const generalLimiter = createRateLimiter({
  maxAttempts: 100,
  windowMs: 60 * 1000,    // 1 minute
  keyPrefix: 'general',
  message: 'Rate limit exceeded. Please slow down.'
});

module.exports = {
  createRateLimiter,
  loginLimiter,
  otpLimiter,
  otpRequestLimiter,
  refreshLimiter,
  generalLimiter
};
