import rateLimit from "express-rate-limit";


export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: "Too many authentication attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests (only count failed attempts)
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


export const tradeOpenRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 trades per minute
  message: {
    error: "Too many trade requests. Maximum 30 trades per minute allowed.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use userId from auth middleware for per-user limiting
  keyGenerator: (req) => {
    return req.userId || req.ip || "unknown";
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
    return req.userId || req.ip || "unknown";
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
    return req.userId || req.ip || "unknown";
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
    return req.userId || req.ip || "unknown";
  },
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
