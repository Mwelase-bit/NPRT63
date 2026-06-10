// middleware/auth.js — JWT authentication middleware
const jwt = require('jsonwebtoken');
const { pool } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_render_123';

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorised. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify the user still exists in the DB
        const result = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) {
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
