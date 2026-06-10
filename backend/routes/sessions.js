// routes/sessions.js — Focus session recording and history retrieval
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');

// ─── POST /api/sessions — Record a completed or interrupted focus session ──────
router.post('/', authenticate, async (req, res) => {
    try {
        const { duration, elapsed, completed } = req.body;
        const userId = req.user.id;

        if (!duration || !Number.isFinite(duration) || duration <= 0 || duration > 86_400) {
            return res.status(400).json({ error: 'duration must be a positive number of seconds (max 24 hours).' });
        }
        if (elapsed === undefined || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 86_400) {
            return res.status(400).json({ error: 'elapsed must be a non-negative number of seconds (max 24 hours).' });
        }
        if (elapsed > duration) {
            return res.status(400).json({ error: 'elapsed cannot exceed duration.' });
        }

        const isCompleted = !!completed;

        // ── Coin calculation ────────────────────────────────────────────────────
        let coinsEarned = 0;
        if (isCompleted) {
            const userRes = await pool.query('SELECT streak FROM users WHERE id = $1', [userId]);
            const streak = userRes.rows[0]?.streak || 0;
            const baseCoins = Math.floor(elapsed / 60);
            const streakBonus = Math.min(streak * 5, 50);
            coinsEarned = baseCoins + streakBonus;
        }

        // ── Insert session record ──────────────────────────────────────────────
        await pool.query(`
            INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, duration, elapsed, isCompleted, coinsEarned]);

        // ── Update user stats if session was completed ─────────────────────────
        if (isCompleted) {
            const today     = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

            const userRes = await pool.query('SELECT streak, last_focus_date FROM users WHERE id = $1', [userId]);
            const user = userRes.rows[0];

            let newStreak = user.streak || 0;
            if (user.last_focus_date === yesterday) {
                newStreak += 1;         // Continue streak
            } else if (user.last_focus_date !== today) {
                newStreak = 1;          // Streak broken — reset to 1
            }
            // else: already focused today — streak unchanged

            // House only built if ≥ 45 minutes
            const MIN_HOUSE_SECONDS = 45 * 60;
            const houseIncrement = elapsed >= MIN_HOUSE_SECONDS ? 1 : 0;

            await pool.query(`
                UPDATE users
                SET coins           = coins + $1,
                    streak          = $2,
                    last_focus_date = $3,
                    houses_built    = houses_built + $4,
                    total_focus_sec = total_focus_sec + $5
                WHERE id = $6
            `, [coinsEarned, newStreak, today, houseIncrement, elapsed, userId]);
        }

        res.status(201).json({
            message: isCompleted ? 'Session completed! Coins awarded.' : 'Session recorded.',
            coinsEarned,
            completed: isCompleted
        });
    } catch (err) {
        console.error('Session record error:', err);
        res.status(500).json({ error: 'Server error recording session.' });
    }
});

// ─── GET /api/sessions — Session history for the logged-in user ───────────────
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        const [sessionsRes, countRes] = await Promise.all([
            pool.query(`
                SELECT id, duration, elapsed, completed, coins_earned, created_at
                FROM focus_sessions
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]),

            pool.query('SELECT COUNT(*) AS cnt FROM focus_sessions WHERE user_id = $1', [userId])
        ]);

        res.json({
            sessions: sessionsRes.rows.map(s => ({
                id:          s.id,
                duration:    s.duration,
                elapsed:     s.elapsed,
                completed:   s.completed,          // already boolean from PostgreSQL
                coinsEarned: s.coins_earned,
                createdAt:   s.created_at
            })),
            total:  parseInt(countRes.rows[0].cnt, 10),
            limit,
            offset
        });
    } catch (err) {
        console.error('Session history error:', err);
        res.status(500).json({ error: 'Server error fetching session history.' });
    }
});

// ─── GET /api/sessions/stats — Aggregated stats for the logged-in user ─────────
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [userRes, aggRes, todayRes, weekRes] = await Promise.all([
            pool.query(`
                SELECT coins, streak, houses_built, total_focus_sec, last_focus_date
                FROM users WHERE id = $1
            `, [userId]),

            pool.query(`
                SELECT
                    COUNT(*)                                                AS total_sessions,
                    SUM(CASE WHEN completed THEN 1 ELSE 0 END)             AS completed_sessions,
                    COALESCE(MAX(CASE WHEN completed THEN elapsed END), 0) AS longest_session
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
            `, [userId])
        ]);

        const user      = userRes.rows[0];
        const agg       = aggRes.rows[0];
        const today     = todayRes.rows[0];
        const week      = weekRes.rows[0];

        const total     = parseInt(agg.total_sessions, 10);
        const completed = parseInt(agg.completed_sessions, 10);

        res.json({
            coins:            user.coins,
            streak:           user.streak,
            housesBuilt:      user.houses_built,
            totalFocusTime:   user.total_focus_sec,
            lastFocusDate:    user.last_focus_date,
            totalSessions:    total,
            completedSessions: completed,
            failedSessions:   total - completed,
            longestSession:   parseInt(agg.longest_session, 10),
            successRate:      total > 0 ? Math.round((completed / total) * 100) : 100,
            dailyStats:  { sessionsToday:   parseInt(today.sessions, 10), timeToday:   parseInt(today.time, 10) },
            weeklyStats: { sessionsThisWeek: parseInt(week.sessions, 10),  timeThisWeek: parseInt(week.time, 10) }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error fetching stats.' });
    }
});

module.exports = router;
