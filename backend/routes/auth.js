// routes/auth.js — Registration, Login, and Profile endpoints
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');
const { requireFields, validateEmail, validateFaculty, authLimiter } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_render_123';

// ─── Helper ───────────────────────────────────────────────────────────────────
const generateToken = (user) =>
    jwt.sign(
        { id: user.id, email: user.email, faculty: user.faculty },
        JWT_SECRET,
        { expiresIn: '30d' }  // Extended to 30 days so users stay logged in longer
    );

const safeUser = (u) => {
    const { password, ...rest } = u;
    return rest;
};

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
    '/register',
    authLimiter,
    requireFields(['name', 'email', 'password', 'faculty']),
    async (req, res, next) => {
        try {
            const { name, email, password, faculty, student_no, gender } = req.body;

            if (!validateEmail(email)) {
                return res.status(400).json({ error: 'Please provide a valid email address.' });
            }
            if (!validateFaculty(faculty)) {
                return res.status(400).json({ error: 'Invalid faculty. Must be one of: nas, edu, ems, hum.' });
            }
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters.' });
            }
            if (name.length < 2 || name.length > 80) {
                return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
            }

            // Check if email already in use
            const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
            if (existing.rows.length > 0) {
                throw new AppError('An account with this email already exists.', 409);
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Insert user — RETURNING gives us the new row immediately
            const result = await pool.query(`
                INSERT INTO users (name, email, password, faculty, student_no, gender)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, name, email, faculty, student_no, gender,
                          coins, streak, houses_built, total_focus_sec, last_focus_date, created_at
            `, [name, email.toLowerCase(), hashedPassword, faculty, student_no || null, gender || 'other']);

            const user = result.rows[0];
            const token = generateToken(user);

            res.status(201).json({
                message: 'Registration successful! Welcome to BUILDHAUS.',
                token,
                user
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
    '/login',
    authLimiter,
    requireFields(['email', 'password']),
    async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!validateEmail(email)) {
                return res.status(400).json({ error: 'Please provide a valid email address.' });
            }

            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
            const user = result.rows[0];
            if (!user) {
                throw new AppError('Invalid email or password.', 401);
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                throw new AppError('Invalid email or password.', 401);
            }

            const token = generateToken(user);

            // Fetch owned items
            const ownedResult = await pool.query('SELECT item_id FROM user_items WHERE user_id = $1', [user.id]);

            res.json({
                message: 'Login successful!',
                token,
                user: safeUser(user),
                ownedItems: ownedResult.rows.map(r => r.item_id)
            });
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, faculty, student_no, gender, coins, streak,
                   houses_built, total_focus_sec, last_focus_date, created_at
            FROM users WHERE id = $1
        `, [req.user.id]);

        const user = result.rows[0];
        if (!user) throw new AppError('User not found.', 404);

        const ownedResult = await pool.query('SELECT item_id FROM user_items WHERE user_id = $1', [user.id]);
        const achResult = await pool.query('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = $1', [user.id]);

        res.json({
            user,
            ownedItems: ownedResult.rows.map(r => r.item_id),
            achievements: achResult.rows
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
