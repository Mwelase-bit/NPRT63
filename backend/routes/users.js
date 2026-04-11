// routes/users.js — Profile updates and user management
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { validateEmail, validateFaculty, requireFields } = require('../middleware/validate');

// ─── PUT /api/users/profile — Update display name and gender ────────────────
router.put('/profile', authenticate, (req, res) => {
    try {
        const { name, gender } = req.body;
        const userId = req.user.id;

        // At least one field must be provided
        if (!name && !gender) {
            return res.status(400).json({ error: 'Provide at least one field to update: name or gender.' });
        }

        // Validate name if provided
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
                return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
            }
        }

        // Validate gender if provided
        const VALID_GENDERS = ['male', 'female', 'other'];
        if (gender !== undefined && !VALID_GENDERS.includes(gender)) {
            return res.status(400).json({ error: 'Gender must be one of: male, female, other.' });
        }

        // Build dynamic update
        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name.trim()); }
        if (gender) { updates.push('gender = ?'); params.push(gender); }
        params.push(userId);

        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        const updated = db.prepare(`
            SELECT id, name, email, faculty, student_no, gender, coins, streak,
                   houses_built, total_focus_sec, last_focus_date, created_at
            FROM users WHERE id = ?
        `).get(userId);

        res.json({ message: 'Profile updated successfully.', user: updated });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error updating profile.' });
    }
});

// ─── PUT /api/users/password — Change password ───────────────────────────────
router.put('/password', authenticate, requireFields(['currentPassword', 'newPassword']), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, userId);

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Server error changing password.' });
    }
});

// ─── GET /api/users/stats — Enriched stats for the current user ──────────────
router.get('/stats', authenticate, (req, res) => {
    try {
        const userId = req.user.id;

        const user = db.prepare(`
            SELECT coins, streak, houses_built, total_focus_sec, last_focus_date
            FROM users WHERE id = ?
        `).get(userId);

        const sessionCounts = db.prepare(`
            SELECT
                COUNT(*) AS total_sessions,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_sessions,
                COALESCE(MAX(CASE WHEN completed = 1 THEN elapsed END), 0) AS longest_session
            FROM focus_sessions WHERE user_id = ?
        `).get(userId);

        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];

        const todayStats = db.prepare(`
            SELECT COUNT(*) AS sessions, COALESCE(SUM(elapsed), 0) AS time
            FROM focus_sessions
            WHERE user_id = ? AND date(created_at) = ? AND completed = 1
        `).get(userId, today);

        const weekStats = db.prepare(`
            SELECT COUNT(*) AS sessions, COALESCE(SUM(elapsed), 0) AS time
            FROM focus_sessions
            WHERE user_id = ? AND date(created_at) >= ? AND completed = 1
        `).get(userId, weekAgo);

        const achievementCount = db.prepare(
            'SELECT COUNT(*) AS cnt FROM achievements WHERE user_id = ?'
        ).get(userId).cnt;

        res.json({
            ...user,
            totalSessions: sessionCounts.total_sessions,
            completedSessions: sessionCounts.completed_sessions,
            failedSessions: sessionCounts.total_sessions - sessionCounts.completed_sessions,
            longestSession: sessionCounts.longest_session,
            successRate: sessionCounts.total_sessions > 0
                ? Math.round((sessionCounts.completed_sessions / sessionCounts.total_sessions) * 100)
                : 100,
            achievementsEarned: achievementCount,
            dailyStats: { sessionsToday: todayStats.sessions, timeToday: todayStats.time },
            weeklyStats: { sessionsThisWeek: weekStats.sessions, timeThisWeek: weekStats.time }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error fetching stats.' });
    }
});

module.exports = router;
