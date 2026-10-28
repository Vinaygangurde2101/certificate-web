import rateLimit from 'express-rate-limit';

// Strict limiter on access-code / certificate verification endpoint to prevent brute force
export const portalVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many verification attempts from this IP address. Please try again after 15 minutes.'
  }
});

// General API limiter
export const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
