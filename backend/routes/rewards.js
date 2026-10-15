// routes/rewards.js - bonuses a student can claim, checked and paid by the server.
//
//   GET  /api/rewards/status   what can be claimed right now, streak milestones, booster stock
//   POST /api/rewards/claim    { kind: 'daily_login' | 'daily_progress' | 'weekly_challenge' }
//
// Before this existed the Rewards screen added coins in the browser only, and the next sync
// from the server quietly took them away. Now the server decides whether a claim is allowed
// (right target reached, not already claimed this period) and adds the coins in one transaction.
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');
const { notifyUser } = require('../utils/notify');
const { CLAIMS, STREAK_MILESTONE_COINS, BOOSTERS, dayKey, weekInfo } = require('../utils/rewardRules');

router.use(authenticate);

// Completed sessions and minutes for a student since a date (YYYY-MM-DD, inclusive)
async function progressSince(userId, fromDate) {
    const r = await pool.query(`
        SELECT COUNT(*) AS n, COALESCE(SUM(elapsed), 0) AS sec
        FROM focus_sessions
        WHERE user_id = $1 AND completed = TRUE AND created_at::date >= $2
    `, [userId, fromDate]);
    return { sessions: parseInt(r.rows[0].n, 10), minutes: Math.floor(parseInt(r.rows[0].sec, 10) / 60) };
}

// The period key a claim belongs to ("2026-10-15" for daily, "2026-W42" for weekly)
const periodOf = (kind) => (CLAIMS[kind].period === 'week' ? weekInfo().key : dayKey());

async function claimedThisPeriod(userId, kind) {
    const r = await pool.query('SELECT 1 FROM reward_claims WHERE user_id = $1 AND kind = $2 AND period = $3', [userId, kind, periodOf(kind)]);
    return r.rows.length > 0;
}

// ─── GET /api/rewards/status ──────────────────────────────────────────────────
router.get('/status', async (req, res) => {
    const userId = req.user.id;
    const [today, week, user, boost] = await Promise.all([
        progressSince(userId, dayKey()),
        progressSince(userId, weekInfo().start),
        pool.query('SELECT streak FROM users WHERE id = $1', [userId]),
        pool.query('SELECT kind, charges FROM user_boosters WHERE user_id = $1', [userId])
    ]);
    const streak = user.rows[0] ? user.rows[0].streak : 0;

    const daily = CLAIMS.daily_progress.needs;
    const eligible = {
        daily_login: true,
        daily_progress: today.sessions >= daily.sessions || today.minutes >= daily.minutes,
        weekly_challenge: week.sessions >= CLAIMS.weekly_challenge.needs.sessions
    };
    const claims = {};
    for (const kind of Object.keys(CLAIMS)) {
        claims[kind] = { coins: CLAIMS[kind].coins, claimed: await claimedThisPeriod(userId, kind), eligible: eligible[kind] };
    }
    const stock = Object.fromEntries(boost.rows.map(r => [r.kind, r.charges]));
    res.json({
        claims,
        progress: {
            today,
            week,
            dailyTargets: daily,
            weeklyTarget: CLAIMS.weekly_challenge.needs.sessions
        },
        streak,
        milestones: Object.entries(STREAK_MILESTONE_COINS).map(([days, coins]) => ({ days: Number(days), coins, reached: streak >= Number(days) })),
        boosters: {
            focus_potion: stock.focus_potion || 0,
            streak_shield: stock.streak_shield || 0,
            xp_amplifier: stock.xp_amplifier || 0
        }
    });
});

// ─── POST /api/rewards/claim ──────────────────────────────────────────────────
router.post('/claim', async (req, res) => {
    const kind = req.body && req.body.kind;
    if (typeof kind !== 'string' || !CLAIMS[kind]) {
        throw new AppError(`kind must be one of: ${Object.keys(CLAIMS).join(', ')}.`, 400);
    }
    const userId = req.user.id;
    const rule = CLAIMS[kind];

    // The target must really be reached (checked here, never trusted from the browser)
    if (kind === 'daily_progress') {
        const p = await progressSince(userId, dayKey());
        if (p.sessions < rule.needs.sessions && p.minutes < rule.needs.minutes) {
            throw new AppError(`Finish ${rule.needs.sessions} sessions or ${rule.needs.minutes} minutes today to claim this.`, 403);
        }
    } else if (kind === 'weekly_challenge') {
        const p = await progressSince(userId, weekInfo().start);
        if (p.sessions < rule.needs.sessions) {
            throw new AppError(`Finish ${rule.needs.sessions} sessions this week to claim this (you have ${p.sessions}).`, 403);
        }
    }

    // Record the claim and pay the coins together. The claim row is unique per period, so two
    // taps (or two devices) at the same moment can never pay twice.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        try {
            await client.query('INSERT INTO reward_claims (user_id, kind, period, coins) VALUES ($1, $2, $3, $4)', [userId, kind, periodOf(kind), rule.coins]);
        } catch (err) {
            await client.query('ROLLBACK').catch(() => { });
            if (err.code === '23505') throw new AppError(`You already claimed this ${rule.period === 'week' ? 'week' : 'today'}.`, 409);
            throw err;
        }
        const upd = await client.query('UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins', [rule.coins, userId]);
        await client.query('COMMIT');
        await notifyUser(userId, { category: 'achievements', kind: 'reward_claimed', title: `${rule.label}: +${rule.coins} coins`, link: 'rewards', push: false });
        res.status(201).json({ kind, coins: rule.coins, balance: upd.rows[0].coins });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    } finally {
        client.release();
    }
});

module.exports = router;
