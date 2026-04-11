// middleware/validate.js — Input validation helpers and middleware factories

const VALID_FACULTIES = ['nas', 'edu', 'ems', 'hum'];

/**
 * Validates that required fields are present and non-empty.
 * Usage: requireFields(['name','email'])(req, res, next)
 */
const requireFields = (fields) => (req, res, next) => {
    const missing = fields.filter(f => {
        const val = req.body[f];
        return val === undefined || val === null || String(val).trim() === '';
    });
    if (missing.length > 0) {
        return res.status(400).json({
            error: `Missing required field(s): ${missing.join(', ')}.`
        });
    }
    next();
};

/**
 * Validates email format
 */
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

/**
 * Validates that a faculty code is valid
 */
const validateFaculty = (faculty) => VALID_FACULTIES.includes(faculty);

/**
 * Express middleware that sanitises common string fields by trimming whitespace
 */
const sanitiseBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        }
    }
    next();
};

/**
 * Simple in-memory rate limiter per IP
 * Limits to `maxRequests` within `windowMs` milliseconds
 */
const createRateLimiter = (maxRequests = 20, windowMs = 60_000) => {
    const requests = new Map();

    // Periodically prune stale IPs to prevent memory leaks
    const CLEANUP_INTERVAL = 5 * 60_000; // every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [ip, timestamps] of requests) {
            const active = timestamps.filter(t => now - t < windowMs);
            if (active.length === 0) {
                requests.delete(ip);
            } else {
                requests.set(ip, active);
            }
        }
    }, CLEANUP_INTERVAL).unref(); // unref so it doesn't keep the process alive

    return (req, res, next) => {
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();

        if (!requests.has(ip)) {
            requests.set(ip, []);
        }

        // Prune old entries outside window
        const timestamps = requests.get(ip).filter(t => now - t < windowMs);
        timestamps.push(now);
        requests.set(ip, timestamps);

        if (timestamps.length > maxRequests) {
            return res.status(429).json({
                error: 'Too many requests. Please slow down and try again shortly.'
            });
        }

        next();
    };
};

// Preset limiters
const authLimiter = createRateLimiter(10, 60_000);   // 10 auth attempts/min
const generalLimiter = createRateLimiter(60, 60_000);   // 60 general requests/min

module.exports = {
    requireFields,
    validateEmail,
    validateFaculty,
    sanitiseBody,
    createRateLimiter,
    authLimiter,
    generalLimiter,
    VALID_FACULTIES
};
