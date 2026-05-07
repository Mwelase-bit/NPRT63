// middleware/auth.js — JWT authentication middleware
const jwt = require('jsonwebtoken');
const db  = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_render_123';

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorised. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify the user still exists in the DB (guards against post-wipe stale tokens)
        const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.id);
        if (!exists) {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }

        req.user = decoded; // { id, email, faculty }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

module.exports = { authenticate };
