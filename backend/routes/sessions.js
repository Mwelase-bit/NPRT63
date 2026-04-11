// routes/sessions.js — Focus session recording and history retrieval
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');

// ─── POST /api/sessions — Record a completed or interrupted focus session ─────
router.post('/', authenticate, (req, res) => {
    try {
        const { duration, elapsed, completed } = req.body;
        const userId = req.user.id;

        // duration = planned seconds, elapsed = actual seconds spent
        if (!duration || !Number.isFinite(duration) || duration <= 0 || duration > 86_400) {
            return res.status(400).json({ error: 'duration must be a positive number of seconds (max 24 hours).' });
        }
        if (elapsed === undefined || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 86_400) {
            return res.status(400).json({ error: 'elapsed must be a non-negative number of seconds (max 24 hours).' });
        }
        if (elapsed > duration) {
            return res.status(400).json({ error: 'elapsed cannot exceed duration.' });
        }

        const isCompleted = completed ? 1 : 0;

        // ── Coin calculation ───────────────────────────────────────────────────
        let coinsEarned = 0;
        if (isCompleted) {
            const user = db.prepare('SELECT streak FROM users WHERE id = ?').get(userId);
            const baseCoins = Math.floor(elapsed / 60);         // 1 coin per minute
            const streakBonus = Math.min((user.streak || 0) * 5, 50); // max 50 bonus
            coinsEarned = baseCoins + streakBonus;
        }

        // ── Insert session record ─────────────────────────────────────────────
        db.prepare(`
            INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, duration, elapsed, isCompleted, coinsEarned);

        // ── Update user stats if session was completed ─────────────────────────
        if (isCompleted) {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
            const user = db.prepare('SELECT streak, last_focus_date FROM users WHERE id = ?').get(userId);

            let newStreak = user.streak || 0;
            if (user.last_focus_date === yesterday) {
                newStreak += 1;             // Continue streak
            } else if (user.last_focus_date !== today) {
                newStreak = 1;              // Streak broken — reset to 1
            }
            // else: already focused today, streak unchanged

            db.prepare(`
                UPDATE users
                SET coins           = coins + ?,
                    streak          = ?,
                    last_focus_date = ?,
                    houses_built    = houses_built + 1,
                    total_focus_sec = total_focus_sec + ?
                WHERE id = ?
            `).run(coinsEarned, newStreak, today, elapsed, userId);
        }

        res.status(201).json({
            message: isCompleted ? 'Session completed! Coins awarded.' : 'Session recorded.',
            coinsEarned,
            completed: isCompleted === 1
        });
    } catch (err) {
        console.error('Session record error:', err);
        res.status(500).json({ error: 'Server error recording session.' });
    }
});

// ─── GET /api/sessions — Session history for the logged-in user ───────────────
router.get('/', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        const sessions = db.prepare(`
            SELECT id, duration, elapsed, completed, coins_earned, created_at
            FROM focus_sessions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(userId, limit, offset);

        const total = db.prepare('SELECT COUNT(*) AS cnt FROM focus_sessions WHERE user_id = ?').get(userId).cnt;

        res.json({
            sessions: sessions.map(s => ({
                id: s.id,
                duration: s.duration,
                elapsed: s.elapsed,
                completed: s.completed === 1,
                coinsEarned: s.coins_earned,
                createdAt: s.created_at
            })),
            total,
            limit,
            offset
        });
    } catch (err) {
        console.error('Session history error:', err);
        res.status(500).json({ error: 'Server error fetching session history.' });
    }
});

// ─── GET /api/sessions/stats — Aggregated stats for the logged-in user ────────
router.get('/stats', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.prepare(`
            SELECT coins, streak, houses_built, total_focus_sec, last_focus_date
            FROM users WHERE id = ?
        `).get(userId);

        const agg = db.prepare(`
            SELECT
                COUNT(*) AS total_sessions,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_sessions,
                COALESCE(MAX(CASE WHEN completed = 1 THEN elapsed END), 0) AS longest_session
            FROM focus_sessions WHERE user_id = ?
        `).get(userId);

        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];

        const todayRow = db.prepare(`
            SELECT COUNT(*) AS sessions, COALESCE(SUM(elapsed), 0) AS time
            FROM focus_sessions
            WHERE user_id = ? AND date(created_at) = ? AND completed = 1
        `).get(userId, today);

        const weekRow = db.prepare(`
            SELECT COUNT(*) AS sessions, COALESCE(SUM(elapsed), 0) AS time
            FROM focus_sessions
            WHERE user_id = ? AND date(created_at) >= ? AND completed = 1
        `).get(userId, weekAgo);

        res.json({
            coins: user.coins,
            streak: user.streak,
            housesBuilt: user.houses_built,
            totalFocusTime: user.total_focus_sec,
            lastFocusDate: user.last_focus_date,
            totalSessions: agg.total_sessions,
            completedSessions: agg.completed_sessions,
            failedSessions: agg.total_sessions - agg.completed_sessions,
            longestSession: agg.longest_session,
            successRate: agg.total_sessions > 0
                ? Math.round((agg.completed_sessions / agg.total_sessions) * 100)
                : 100,
            dailyStats: { sessionsToday: todayRow.sessions, timeToday: todayRow.time },
            weeklyStats: { sessionsThisWeek: weekRow.sessions, timeThisWeek: weekRow.time }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error fetching stats.' });
    }
});

module.exports = router;
