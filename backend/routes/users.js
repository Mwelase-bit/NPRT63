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
                    COALESCE(SUM(CASE WHEN completed THEN 1 ELSE 0 END), 0) AS completed_sessions,
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

// ─── Character appearance ─────────────────────────────────────────────────────
// The student's builder (face, hair, outfit, hat, tool) is saved here so it follows them to
// any device. Every field is checked against a fixed list, and shop items are only accepted
// if the student actually owns them.
const HEX = /^#[0-9a-fA-F]{6}$/;
const AVATAR_FIELDS = {
    gender:        { oneOf: ['male', 'female', 'other'] },
    skinColor:     { hex: true },
    hairColor:     { hex: true },
    eyeColor:      { hex: true },
    overallColor:  { hex: true },
    hatColor:      { hex: true },
    hairStyle:     { oneOf: ['short', 'spiky', 'long', 'ponytail', 'bun', 'afro', 'curly', 'buzz', 'bald'] },
    mouth:         { oneOf: ['smile', 'grin', 'neutral', 'smirk'] },
    facialHair:    { oneOf: ['none', 'stubble', 'moustache', 'beard'] },
    glasses:       { oneOf: ['none', 'round', 'square'] },
    outfit:        { oneOf: ['default', 'outfit_architect', 'outfit_wizard', 'outfit_ninja', 'outfit_knight', 'outfit_astronaut'], shop: true },
    hat:           { oneOf: ['hardhat', 'cap', 'none', 'hat_tophat', 'hat_crown', 'hat_beret', 'hat_beanie', 'hat_helmet'], shop: true },
    tool:          { oneOf: ['hammer', 'none', 'tool_wrench', 'tool_paintbrush', 'tool_drill', 'tool_wand'], shop: true }
};
const FREE_ITEMS = ['default', 'hardhat', 'cap', 'none', 'hammer'];

async function ownedItemIds(userId) {
    const r = await pool.query('SELECT item_id FROM user_items WHERE user_id = $1', [userId]);
    return r.rows.map(x => x.item_id);
}

// GET /api/users/avatar - the saved look (null if the student never customised) and what they own
router.get('/avatar', authenticate, async (req, res) => {
    try {
        const r = await pool.query('SELECT data FROM user_avatars WHERE user_id = $1', [req.user.id]);
        let avatar = null;
        if (r.rows[0]) {
            try { avatar = JSON.parse(r.rows[0].data); } catch (e) { avatar = null; }   // a damaged row is treated as "not saved"
        }
        res.json({ avatar, owned: await ownedItemIds(req.user.id) });
    } catch (err) {
        console.error('Avatar load error:', err);
        res.status(500).json({ error: 'Server error loading your character.' });
    }
});

// PUT /api/users/avatar - save some or all fields; unknown fields and bad values are rejected
router.put('/avatar', authenticate, async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
            return res.status(400).json({ error: 'Send the character fields you want to change.' });
        }
        const owned = await ownedItemIds(req.user.id);
        const clean = {};
        for (const [key, value] of Object.entries(body)) {
            const rule = AVATAR_FIELDS[key];
            if (!rule) return res.status(400).json({ error: `Unknown character field "${key}".` });
            if (rule.hex && !(typeof value === 'string' && HEX.test(value))) {
                return res.status(400).json({ error: `${key} must be a colour like #aabbcc.` });
            }
            if (rule.oneOf && !rule.oneOf.includes(value)) {
                return res.status(400).json({ error: `${key} must be one of: ${rule.oneOf.join(', ')}.` });
            }
            if (rule.shop && !FREE_ITEMS.includes(value) && !owned.includes(value)) {
                return res.status(403).json({ error: 'You can only use shop items you have bought.' });
            }
            clean[key] = value;
        }
        const existing = await pool.query('SELECT data FROM user_avatars WHERE user_id = $1', [req.user.id]);
        let merged = {};
        if (existing.rows[0]) { try { merged = JSON.parse(existing.rows[0].data) || {}; } catch (e) { merged = {}; } }
        merged = { ...merged, ...clean };
        await pool.query(`
            INSERT INTO user_avatars (user_id, data, updated_at) VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
        `, [req.user.id, JSON.stringify(merged), new Date().toISOString()]);
        res.json({ avatar: merged });
    } catch (err) {
        console.error('Avatar save error:', err);
        res.status(500).json({ error: 'Server error saving your character.' });
    }
});

module.exports = router;
