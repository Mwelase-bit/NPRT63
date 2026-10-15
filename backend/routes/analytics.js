// routes/analytics.js — Personal usage analytics: sessions, focus time, time in
// the app, sign-ins and app visits, over a date range chosen by the student.
//
// Rows are fetched with plain queries and bucketed into days in JS (in the
// student's own time zone), so a late-night session lands on the right day and
// the same code runs on PostgreSQL and on the SQLite stand-in used by the tests.
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');
const { isIntInRange } = require('../middleware/validate');

const MAX_RANGE_DAYS = 366;
const MAX_PING_SECONDS = 120;        // one heartbeat covers at most 2 minutes
const VISIT_COOLDOWN_MS = 30 * 60 * 1000;
const DAY_MS = 86_400_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const validTimeZone = (tz) => {
    if (typeof tz !== 'string' || !tz) return 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { return 'UTC'; }
};

// Postgres hands back Date objects; the SQLite stand-in hands back 'YYYY-MM-DD HH:MM:SS' (UTC)
const toDate = (v) => {
    if (v instanceof Date) return v;
    const s = String(v);
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
};

const makeDayKey = (tz) => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return (d) => fmt.format(d);
};
const makeHourOf = (tz) => {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' });
    return (d) => parseInt(fmt.format(d), 10);
};

// JS happily parses 2026-02-31 as 3 March, so round-trip the date to be sure it is real
const isDateKey = (s) => {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const t = Date.parse(s + 'T00:00:00Z');
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};
const addDays = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS);
const eachDay = (from, to) => {
    const out = [];
    for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
    return out;
};

const emptyDay = (date) => ({
    date, sessions: 0, completed: 0, focusSeconds: 0, appSeconds: 0, logins: 0, visits: 0
});

// ─── POST /api/analytics/heartbeat — time spent in the app ────────────────────
// The client sends one every ~30 s while the app is open and visible.
router.post('/heartbeat', authenticate, async (req, res) => {
    const { seconds } = req.body;
    if (!isIntInRange(seconds, 1, MAX_PING_SECONDS)) {
        return res.status(400).json({ error: `seconds must be a whole number between 1 and ${MAX_PING_SECONDS}.` });
    }
    try {
        const hourStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
        await pool.query(`
            INSERT INTO app_usage (user_id, hour_start, seconds) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, hour_start)
            DO UPDATE SET seconds = app_usage.seconds + EXCLUDED.seconds
        `, [req.user.id, hourStart, seconds]);
        res.json({ ok: true });
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({ error: 'Server error recording app usage.' });
    }
});

// ─── POST /api/analytics/visit — the app was opened with a saved sign-in ──────
// At most one visit is counted per 30 minutes, so reloads don't inflate it.
router.post('/visit', authenticate, async (req, res) => {
    try {
        const last = await pool.query(
            'SELECT created_at FROM login_events WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
            [req.user.id]
        );
        if (last.rows[0] && Date.now() - toDate(last.rows[0].created_at).getTime() < VISIT_COOLDOWN_MS) {
            return res.json({ ok: true, counted: false });
        }
        await pool.query("INSERT INTO login_events (user_id, kind) VALUES ($1, 'visit')", [req.user.id]);
        res.json({ ok: true, counted: true });
    } catch (err) {
        console.error('Visit error:', err);
        res.status(500).json({ error: 'Server error recording visit.' });
    }
});

// ─── GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Africa/Johannesburg ──
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const tz = validTimeZone(req.query.tz);
        const dayKey = makeDayKey(tz);
        const hourOf = makeHourOf(tz);
        const today = dayKey(new Date());

        let { from, to } = req.query;
        to = to === undefined ? today : to;
        if (from === undefined) from = addDays(to, -29);   // default: last 30 days
        if (!isDateKey(from) || !isDateKey(to)) {
            return res.status(400).json({ error: 'from and to must be dates in the form YYYY-MM-DD.' });
        }
        if (from > to) {
            return res.status(400).json({ error: 'from must not be after to.' });
        }
        const days = daysBetween(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            return res.status(400).json({ error: `Pick a range of at most ${MAX_RANGE_DAYS} days.` });
        }

        // The window just before this one, same length, for "vs previous period"
        const prevTo = addDays(from, -1);
        const prevFrom = addDays(from, -days);

        // One day of slack either side covers every time zone; exact day filtering happens in JS
        const lo = new Date(Date.parse(prevFrom + 'T00:00:00Z') - DAY_MS).toISOString();
        const hi = new Date(Date.parse(to + 'T00:00:00Z') + 2 * DAY_MS).toISOString();

        const [sessionsRes, loginsRes, usageRes, allRes] = await Promise.all([
            pool.query(`
                SELECT id, duration, elapsed, completed, coins_earned, created_at
                FROM focus_sessions
                WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
                ORDER BY created_at ASC
            `, [userId, lo, hi]),
            pool.query(`
                SELECT kind, created_at FROM login_events
                WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
            `, [userId, lo, hi]),
            pool.query(`
                SELECT hour_start, seconds FROM app_usage
                WHERE user_id = $1 AND hour_start >= $2 AND hour_start <= $3
            `, [userId, lo, hi]),
            Promise.all([
                pool.query(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN completed THEN elapsed ELSE 0 END), 0) AS sec
                            FROM focus_sessions WHERE user_id = $1`, [userId]),
                pool.query(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN kind = 'login' THEN 1 ELSE 0 END), 0) AS logins
                            FROM login_events WHERE user_id = $1`, [userId]),
                pool.query(`SELECT COALESCE(SUM(seconds), 0) AS sec FROM app_usage WHERE user_id = $1`, [userId]),
                pool.query(`SELECT streak FROM users WHERE id = $1`, [userId])
            ])
        ]);

        // ── Bucket everything into the student's local days ───────────────────
        const dayMap = new Map(eachDay(prevFrom, to).map(k => [k, emptyDay(k)]));
        const byHour = Array.from({ length: 24 }, () => ({ sessions: 0, focusSeconds: 0 }));
        const recent = [];

        for (const s of sessionsRes.rows) {
            const end = toDate(s.created_at);
            const d = dayMap.get(dayKey(end));
            if (!d) continue;
            d.sessions += 1;
            const inRange = d.date >= from;
            if (s.completed) {
                d.completed += 1;
                d.focusSeconds += s.elapsed;
            }
            if (inRange) {
                const start = new Date(end.getTime() - s.elapsed * 1000);
                const h = byHour[hourOf(start)];
                h.sessions += 1;
                if (s.completed) h.focusSeconds += s.elapsed;
                recent.push({
                    id: s.id, endedAt: end.toISOString(), durationSec: s.duration,
                    elapsedSec: s.elapsed, completed: !!s.completed, coinsEarned: s.coins_earned
                });
            }
        }
        for (const e of loginsRes.rows) {
            const d = dayMap.get(dayKey(toDate(e.created_at)));
            if (!d) continue;
            if (e.kind === 'login') d.logins += 1;
            d.visits += 1;           // a sign-in is also a visit
        }
        for (const u of usageRes.rows) {
            const d = dayMap.get(dayKey(toDate(u.hour_start)));
            if (d) d.appSeconds += Math.min(u.seconds, 3600);   // an hour holds at most 3600 s
        }

        const all = [...dayMap.values()];
        const daily = all.filter(d => d.date >= from && d.date <= to);
        const prevDaily = all.filter(d => d.date >= prevFrom && d.date <= prevTo);

        const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
        const totalsOf = (rows) => ({
            sessions: sum(rows, 'sessions'),
            completed: sum(rows, 'completed'),
            focusSeconds: sum(rows, 'focusSeconds'),
            appSeconds: sum(rows, 'appSeconds'),
            logins: sum(rows, 'logins'),
            visits: sum(rows, 'visits')
        });

        const totals = totalsOf(daily);
        const completedInRange = recent.filter(r => r.completed);
        totals.interrupted = totals.sessions - totals.completed;
        totals.successRate = totals.sessions ? Math.round((totals.completed / totals.sessions) * 100) : null;
        totals.activeDays = daily.filter(d => d.sessions > 0 || d.appSeconds > 0 || d.visits > 0).length;
        totals.avgSessionSec = completedInRange.length
            ? Math.round(completedInRange.reduce((n, r) => n + r.elapsedSec, 0) / completedInRange.length) : 0;
        totals.longestSessionSec = completedInRange.reduce((m, r) => Math.max(m, r.elapsedSec), 0);

        const [allSessions, allLogins, allUsage, userRow] = allRes;
        res.json({
            range: { from, to, days, tz },
            totals,
            previous: totalsOf(prevDaily),
            allTime: {
                sessions: parseInt(allSessions.rows[0].n, 10),
                focusSeconds: parseInt(allSessions.rows[0].sec, 10),
                logins: parseInt(allLogins.rows[0].logins, 10),
                visits: parseInt(allLogins.rows[0].n, 10),
                appSeconds: parseInt(allUsage.rows[0].sec, 10),
                streak: userRow.rows[0] ? userRow.rows[0].streak : 0
            },
            daily,
            byHour,
            recent: recent.reverse().slice(0, 10)
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Server error loading analytics.' });
    }
});

module.exports = router;
