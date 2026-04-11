// routes/achievements.js — Sync and retrieve earned achievements
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/achievements — All achievements earned by the current user ───────
router.get('/', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const achievements = db.prepare(`
            SELECT achievement_id, unlocked_at
            FROM achievements
            WHERE user_id = ?
            ORDER BY unlocked_at DESC
        `).all(userId);

        res.json({ achievements });
    } catch (err) {
        console.error('Achievements fetch error:', err);
        res.status(500).json({ error: 'Server error fetching achievements.' });
    }
});

// ─── POST /api/achievements/unlock — Record a newly unlocked achievement ───────
// The frontend determines when an achievement condition is met and calls this.
router.post('/unlock', authenticate, (req, res) => {
    try {
        const { achievementId } = req.body;
        const userId = req.user.id;

        if (!achievementId || typeof achievementId !== 'string') {
            return res.status(400).json({ error: 'achievementId is required.' });
        }

        // Idempotent insert — silently ignores duplicates
        const result = db.prepare(`
            INSERT OR IGNORE INTO achievements (user_id, achievement_id)
            VALUES (?, ?)
        `).run(userId, achievementId);

        if (result.changes === 0) {
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
