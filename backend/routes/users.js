// routes/users.js — Profile updates and user management
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

// ─── PUT /api/users/profile — Update display name and gender ──────────────────
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, gender } = req.body;
        const userId = req.user.id;

        if (!name && !gender) {
            return res.status(400).json({ error: 'Provide at least one field to update: name or gender.' });
        }

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
                return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
            }
        }

        const VALID_GENDERS = ['male', 'female', 'other'];
        if (gender !== undefined && !VALID_GENDERS.includes(gender)) {
            return res.status(400).json({ error: 'Gender must be one of: male, female, other.' });
        }

        // Build dynamic update with $N placeholders
        const updates = [];
        const params = [];
        let i = 1;
        if (name)   { updates.push(`name = $${i++}`);   params.push(name.trim()); }
        if (gender) { updates.push(`gender = $${i++}`); params.push(gender); }
        params.push(userId);

        const result = await pool.query(`
            UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
            RETURNING id, name, email, faculty, student_no, gender,
                      coins, streak, houses_built, total_focus_sec, last_focus_date, created_at
        `, params);

        res.json({ message: 'Profile updated successfully.', user: result.rows[0] });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error updating profile.' });
    }
});

// ─── PUT /api/users/password — Change password ────────────────────────────────
router.put('/password', authenticate, requireFields(['currentPassword', 'newPassword']), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Server error changing password.' });
    }
});

// ─── GET /api/users/stats — Enriched stats for the current user ───────────────
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [userRes, sessionRes, todayRes, weekRes, achRes] = await Promise.all([
            pool.query(`
                SELECT coins, streak, houses_built, total_focus_sec, last_focus_date
                FROM users WHERE id = $1
            `, [userId]),

            pool.query(`
                SELECT
                    COUNT(*)                                                  AS total_sessions,
                    SUM(CASE WHEN completed THEN 1 ELSE 0 END)               AS completed_sessions,
                    COALESCE(MAX(CASE WHEN completed THEN elapsed END), 0)   AS longest_session
                FROM focus_sessions WHERE user_id = $1
            `, [userId]),

            pool.query(`
                SELECT COUNT(*) AS sessions, COALESCE(SUM(elapsed), 0) AS time
                FROM focus_sessions
                WHERE user_id = $1
                  AND created_at::date = CURRENT_DATE
                  AND completed = TRUE
            `, [userId]),

            pool.query(`
                SELECT COUNT(*) AS sessions, COALESCE(SUM(elapsed), 0) AS time
                FROM focus_sessions
                WHERE user_id = $1
                  AND created_at::date >= (CURRENT_DATE - INTERVAL '7 days')
                  AND completed = TRUE
            `, [userId]),

            pool.query('SELECT COUNT(*) AS cnt FROM achievements WHERE user_id = $1', [userId])
        ]);

        const user       = userRes.rows[0];
        const sessions   = sessionRes.rows[0];
        const today      = todayRes.rows[0];
        const week       = weekRes.rows[0];
        const achCount   = parseInt(achRes.rows[0].cnt, 10);

        const total     = parseInt(sessions.total_sessions, 10);
        const completed = parseInt(sessions.completed_sessions, 10);

        res.json({
            ...user,
            totalSessions: total,
            completedSessions: completed,
            failedSessions: total - completed,
            longestSession: parseInt(sessions.longest_session, 10),
            successRate: total > 0 ? Math.round((completed / total) * 100) : 100,
            achievementsEarned: achCount,
            dailyStats:  { sessionsToday:       parseInt(today.sessions, 10), timeToday:        parseInt(today.time, 10) },
            weeklyStats: { sessionsThisWeek:     parseInt(week.sessions, 10),  timeThisWeek:     parseInt(week.time, 10) }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error fetching stats.' });
    }
});

module.exports = router;
