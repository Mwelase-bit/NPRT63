// routes/sessions.js — Focus session recording and history retrieval
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');
const { isIntInRange } = require('../middleware/validate');
const { notifyUser, notifyMany, friendIdsOf, nameOf, broadcastAllowed } = require('../utils/notify');
const { STREAK_MILESTONE_COINS } = require('../utils/rewardRules');

// ─── POST /api/sessions — Record a completed or interrupted focus session ──────
const MAX_SESSION_SEC   = 86_400;   // 24 hours
const MIN_HOUSE_SECONDS = 45 * 60;  // one house per 45 cumulative focus minutes (matches App.jsx)

router.post('/', authenticate, async (req, res) => {
    const { duration, elapsed, completed } = req.body;
    const userId = req.user.id;

    // Whole seconds only — the DB columns are INTEGER and Postgres rejects 1500.5
    if (!isIntInRange(duration, 1, MAX_SESSION_SEC)) {
        return res.status(400).json({ error: 'duration must be a whole number of seconds between 1 and 86400.' });
    }
    if (!isIntInRange(elapsed, 0, MAX_SESSION_SEC)) {
        return res.status(400).json({ error: 'elapsed must be a whole number of seconds between 0 and 86400.' });
    }
    if (elapsed > duration) {
        return res.status(400).json({ error: 'elapsed cannot exceed duration.' });
    }
    // Must be a real boolean: the string "false" is truthy and used to count as a completed session
    if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'completed must be true or false.' });
    }
    // A completed session ran its full length (the timer sends elapsed === duration)
    if (completed && elapsed !== duration) {
        return res.status(400).json({ error: 'A completed session must have elapsed equal to duration.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the user row so two sessions finishing together can't double-count houses/streaks
        const userRes = await client.query(
            'SELECT streak, last_focus_date, total_focus_sec FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        const user = userRes.rows[0];

        let coinsEarned = 0;
        let streakAfter = user.streak || 0;
        const streakBefore = user.streak || 0;
        let boosterUsed = null;                 // 'focus_potion' | 'xp_amplifier' when a booster changed the coins
        let shieldUsed = false;                 // true when a streak shield saved the streak
        let milestoneBonus = 0;                 // extra coins for reaching a streak milestone

        // A booster charge is spent only on a completed session. Focus Potion doubles the coins;
        // otherwise the XP Amplifier adds 50%. Only one applies per session.
        const chargeOf = async (kind) => {
            const r = await client.query('SELECT charges FROM user_boosters WHERE user_id = $1 AND kind = $2', [userId, kind]);
            return r.rows[0] ? r.rows[0].charges : 0;
        };
        const spend = (kind) => client.query('UPDATE user_boosters SET charges = charges - 1 WHERE user_id = $1 AND kind = $2 AND charges > 0', [userId, kind]);

        if (completed) {
            const baseCoins   = Math.floor(elapsed / 60);
            const streakBonus = Math.min((user.streak || 0) * 5, 50);
            coinsEarned = baseCoins + streakBonus;
            if (await chargeOf('focus_potion') > 0) { coinsEarned *= 2; boosterUsed = 'focus_potion'; await spend('focus_potion'); }
            else if (await chargeOf('xp_amplifier') > 0) { coinsEarned = Math.floor(coinsEarned * 1.5); boosterUsed = 'xp_amplifier'; await spend('xp_amplifier'); }
        }

        await client.query(`
            INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, duration, elapsed, completed, coinsEarned]);

        if (completed) {
            const today     = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

            const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().split('T')[0];

            let newStreak = user.streak || 0;
            if (user.last_focus_date === yesterday) {
                newStreak += 1;         // Continue streak
            } else if (user.last_focus_date !== today) {
                // One missed day: a Streak Shield charge keeps the streak alive (and counts today)
                if (user.last_focus_date === twoDaysAgo && newStreak > 0 && await chargeOf('streak_shield') > 0) {
                    newStreak += 1;
                    shieldUsed = true;
                    await spend('streak_shield');
                } else {
                    newStreak = 1;      // Streak broken (or first ever) — start at 1
                }
            }
            // else: already focused today — streak unchanged
            streakAfter = newStreak;

            // Reaching a streak milestone pays a one-off bonus
            if (newStreak > streakBefore && STREAK_MILESTONE_COINS[newStreak]) milestoneBonus = STREAK_MILESTONE_COINS[newStreak];

            // Houses are cumulative across sessions. total_focus_sec was previously
            // never SELECTed, so every session was treated as starting from 0.
            const currentTotal   = user.total_focus_sec || 0;
            const newTotal       = currentTotal + elapsed;
            const houseIncrement = Math.floor(newTotal / MIN_HOUSE_SECONDS) - Math.floor(currentTotal / MIN_HOUSE_SECONDS);

            await client.query(`
                UPDATE users
                SET coins           = coins + $1,
                    streak          = $2,
                    last_focus_date = $3,
                    houses_built    = houses_built + $4,
                    total_focus_sec = total_focus_sec + $5
                WHERE id = $6
            `, [coinsEarned + milestoneBonus, newStreak, today, houseIncrement, elapsed, userId]);
        }

        await client.query('COMMIT');

        // Tell friends, and celebrate a streak milestone (both are best-effort and never fail the request)
        if (completed) {
            await announceFinish(userId, elapsed, streakAfter, streakBefore, milestoneBonus);
        }

        res.status(201).json({
            message: completed ? 'Session completed! Coins awarded.' : 'Session recorded.',
            coinsEarned,
            completed,
            boosterUsed,
            shieldUsed,
            milestoneBonus
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Session record error:', err);
        res.status(500).json({ error: 'Server error recording session.' });
    } finally {
        client.release();
    }
});


// ─── Notifications around sessions ────────────────────────────────────────────
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
const fmtMinutes = (sec) => {
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${Math.max(1, m)} min`;
};

// A friend finished a session, and the student may have hit a streak milestone
async function announceFinish(userId, elapsed, streakAfter, streakBefore, milestoneBonus) {
    try {
        if (streakAfter > streakBefore && STREAK_MILESTONES.includes(streakAfter)) {
            await notifyUser(userId, { category: 'achievements', kind: 'streak', title: `${streakAfter}-day streak`, body: milestoneBonus ? `+${milestoneBonus} bonus coins. Keep it going.` : 'Keep it going. Study again tomorrow.', link: 'rewards', push: false });
        }
        if (broadcastAllowed(userId, 'finished')) {
            const friends = await friendIdsOf(userId);
            await notifyMany(friends, {
                category: 'friends', kind: 'friend_finished', title: `${await nameOf(userId)} finished a ${fmtMinutes(elapsed)} session`,
                body: 'Nice work. Your turn?', link: 'community:friends'
            }, userId);
        }
    } catch (err) {
        console.warn('Could not announce a finished session:', err.message);
    }
}

// ─── POST /api/sessions/start - "a friend started a session" ──────────────────
// Called by the app the moment a focus session begins. Nothing is stored; friends are told once
// per student per 10 minutes so a run of short sessions cannot flood them.
router.post('/start', authenticate, async (req, res) => {
    const { duration } = req.body || {};
    if (!isIntInRange(duration, 1, MAX_SESSION_SEC)) {
        return res.status(400).json({ error: 'duration must be a whole number of seconds between 1 and 86400.' });
    }
    try {
        let notified = 0;
        if (broadcastAllowed(req.user.id, 'started')) {
            const friends = await friendIdsOf(req.user.id);
            notified = await notifyMany(friends, {
                category: 'friends', kind: 'friend_started', title: `${await nameOf(req.user.id)} started a ${fmtMinutes(duration)} session`,
                body: 'Join them and study together.', link: 'community:friends'
            }, req.user.id);
        }
        res.json({ ok: true, notified });
    } catch (err) {
        console.error('Session start notice error:', err);
        res.status(500).json({ error: 'Server error announcing the session.' });
    }
});

// ─── GET /api/sessions — Session history for the logged-in user ───────────────
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        // Clamp paging — a negative LIMIT/OFFSET is a Postgres error (500)
        const rawLimit  = parseInt(req.query.limit, 10);
        const rawOffset = parseInt(req.query.offset, 10);
        const limit  = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
        const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

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
                    COALESCE(SUM(CASE WHEN completed THEN 1 ELSE 0 END), 0) AS completed_sessions,
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
