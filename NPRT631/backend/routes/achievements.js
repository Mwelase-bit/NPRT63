// routes/achievements.js — Sync and retrieve earned achievements
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/achievements — All achievements earned by the current user ────────
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT achievement_id, unlocked_at
            FROM achievements
            WHERE user_id = $1
            ORDER BY unlocked_at DESC
        `, [req.user.id]);

        res.json({ achievements: result.rows });
    } catch (err) {
        console.error('Achievements fetch error:', err);
        res.status(500).json({ error: 'Server error fetching achievements.' });
    }
});

// ─── POST /api/achievements/unlock — Record a newly unlocked achievement ────────
router.post('/unlock', authenticate, async (req, res) => {
    try {
        const { achievementId } = req.body;
        const userId = req.user.id;

        if (!achievementId || typeof achievementId !== 'string') {
            return res.status(400).json({ error: 'achievementId is required.' });
        }

        // ON CONFLICT DO NOTHING is the PostgreSQL equivalent of SQLite's INSERT OR IGNORE
        const result = await pool.query(`
            INSERT INTO achievements (user_id, achievement_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
        `, [userId, achievementId]);

        if (result.rowCount === 0) {
            return res.json({ message: 'Achievement already unlocked.', alreadyUnlocked: true });
        }

        res.status(201).json({
            message: 'Achievement unlocked!',
            achievementId,
            alreadyUnlocked: false
        });
    } catch (err) {
        console.error('Achievement unlock error:', err);
        res.status(500).json({ error: 'Server error unlocking achievement.' });
    }
});

module.exports = router;
