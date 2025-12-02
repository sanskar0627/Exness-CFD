import rateLimit from "express-rate-limit";

// IP-based rate limiters (default behavior, no custom keyGenerator needed)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: "Too many authentication attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

export const oauthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: "Too many OAuth attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  message: {
    error: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User-based rate limiters (use userId when available, fall back to IP)
export const tradeOpenRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 trades per minute
  message: {
    error: "Too many trade requests. Maximum 30 trades per minute allowed.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use userId from auth middleware for per-user limiting
  // If userId exists, use it; otherwise express-rate-limit will use IP automatically
  keyGenerator: (req) => {
    // Only use custom key if userId exists, otherwise let library handle IP
    return req.userId || undefined;
  },
  skip: (req) => {
    // Don't skip any requests
    return false;
  },
});

export const tradeCloseRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 closes per minute
  message: {
    error: "Too many close requests. Maximum 60 closes per minute allowed.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId || undefined;
  },
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: "Too many requests. Maximum 100 requests per minute allowed.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId || undefined;
  },
});

export const chartDataRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: {
    error: "Too many chart data requests. Please reduce refresh frequency.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId || undefined;
  },
});
