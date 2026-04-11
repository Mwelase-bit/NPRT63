// routes/auth.js — Registration, Login, and Profile endpoints
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { requireFields, validateEmail, validateFaculty, authLimiter } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET;

// ─── Helper ───────────────────────────────────────────────────────────────────
const generateToken = (user) =>
    jwt.sign(
        { id: user.id, email: user.email, faculty: user.faculty },
        JWT_SECRET,
        { expiresIn: '7d' }
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
    async (req, res) => {
        try {
            const { name, email, password, faculty, student_no } = req.body;

            // Validate email format
            if (!validateEmail(email)) {
                return res.status(400).json({ error: 'Please provide a valid email address.' });
            }

            // Validate faculty
            if (!validateFaculty(faculty)) {
                return res.status(400).json({
                    error: 'Invalid faculty. Must be one of: nas, edu, ems, hum.'
                });
            }

            // Validate password length
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters.' });
            }

            // Validate name length
            if (name.length < 2 || name.length > 80) {
                return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
            }

            // Check if email already in use
            const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
            if (existing) {
                return res.status(409).json({ error: 'An account with this email already exists.' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Insert user
            const result = db.prepare(`
                INSERT INTO users (name, email, password, faculty, student_no)
                VALUES (?, ?, ?, ?, ?)
            `).run(name, email.toLowerCase(), hashedPassword, faculty, student_no || null);

            const user = db.prepare(`
                SELECT id, name, email, faculty, student_no, gender, coins, streak,
                       houses_built, total_focus_sec, last_focus_date, created_at
                FROM users WHERE id = ?
            `).get(result.lastInsertRowid);

            const token = generateToken(user);

            res.status(201).json({
                message: 'Registration successful! Welcome to BUILDHAUS.',
                token,
                user
            });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ error: 'Server error during registration.' });
        }
    }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
    '/login',
    authLimiter,
    requireFields(['email', 'password']),
    async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!validateEmail(email)) {
                return res.status(400).json({ error: 'Please provide a valid email address.' });
            }

            const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }

            const token = generateToken(user);

            // Fetch owned items
            const ownedItems = db.prepare('SELECT item_id FROM user_items WHERE user_id = ?').all(user.id);

            res.json({
                message: 'Login successful!',
                token,
                user: safeUser(user),
                ownedItems: ownedItems.map(r => r.item_id)
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ error: 'Server error during login.' });
        }
    }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT id, name, email, faculty, student_no, gender, coins, streak,
                   houses_built, total_focus_sec, last_focus_date, created_at
            FROM users WHERE id = ?
        `).get(req.user.id);

        if (!user) return res.status(404).json({ error: 'User not found.' });

        const ownedItems = db.prepare('SELECT item_id FROM user_items WHERE user_id = ?').all(user.id);
        const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?').all(user.id);

        res.json({
            user,
            ownedItems: ownedItems.map(r => r.item_id),
            achievements
        });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ error: 'Server error fetching profile.' });
    }
});

module.exports = router;
