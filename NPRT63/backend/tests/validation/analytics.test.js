// Validation: personal analytics — sign-in and visit tracking, time-in-app
// heartbeats, and the date-ranged summary used by the Insights panel.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);

const get = (token, qs = '') => h.req('GET', `/api/analytics${qs}`, undefined, token);
const beat = (token, seconds) => h.req('POST', '/api/analytics/heartbeat', { seconds }, token);
const visit = (token) => h.req('POST', '/api/analytics/visit', {}, token);
const todayUTC = () => new Date().toISOString().slice(0, 10);
const addDays = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

// Insert a finished session at a chosen time (the API always stamps "now")
const insertSession = (userId, { endedAt, duration, elapsed, completed }) =>
    h.db.query(
        'INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, duration, elapsed, completed, 0, endedAt]
    );

describe('analytics — authentication and input checking', () => {
    test('every endpoint requires a sign-in', async () => {
        assert.equal((await get(undefined)).status, 401);
        assert.equal((await beat(undefined, 30)).status, 401);
        assert.equal((await visit(undefined)).status, 401);
    });

    const badRanges = [
        ['malformed from',     '?from=yesterday&to=2026-01-10'],
        ['impossible date',    '?from=2026-02-31&to=2026-03-10'],
        ['from after to',      '?from=2026-03-10&to=2026-03-01'],
        ['range over a year',  '?from=2024-01-01&to=2026-01-01'],
    ];
    for (const [label, qs] of badRanges) {
        test(`rejects ${label} with 400`, async () => {
            const u = await h.registerUser();
            assert.equal((await get(u.token, qs)).status, 400);
        });
    }

    for (const bad of [0, -5, 121, 1.5, '30', null]) {
        test(`heartbeat rejects seconds=${JSON.stringify(bad)}`, async () => {
            const u = await h.registerUser();
            assert.equal((await beat(u.token, bad)).status, 400);
        });
    }

    test('an unknown time zone falls back to UTC instead of failing', async () => {
        const u = await h.registerUser();
        const r = await get(u.token, '?tz=Not/AZone');
        assert.equal(r.status, 200);
        assert.equal(r.data.range.tz, 'UTC');
    });
});

describe('analytics — sign-ins and visits', () => {
    test('registering and logging in each count as a sign-in', async () => {
        const u = await h.registerUser();
        await h.req('POST', '/api/auth/login', { email: u.email, password: u.password });
        await h.req('POST', '/api/auth/login', { email: u.email, password: u.password });
        const r = await get(u.token);
        assert.equal(r.data.totals.logins, 3);
        assert.equal(r.data.allTime.logins, 3);
    });

    test('a failed login is not counted', async () => {
        const u = await h.registerUser();
        await h.req('POST', '/api/auth/login', { email: u.email, password: 'wrong-password' });
        assert.equal((await get(u.token)).data.totals.logins, 1);
    });

    test('a visit right after a sign-in is not double counted', async () => {
        const u = await h.registerUser();
        const r = await visit(u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.counted, false);
        assert.equal((await get(u.token)).data.totals.visits, 1);
    });

    test('a visit after a long gap is counted once, and reloads are ignored', async () => {
        const u = await h.registerUser();
        await h.db.query("UPDATE login_events SET created_at = $1 WHERE user_id = $2",
            [new Date(Date.now() - 3 * 3_600_000).toISOString(), u.user.id]);
        assert.equal((await visit(u.token)).data.counted, true);
        assert.equal((await visit(u.token)).data.counted, false);
        const t = (await get(u.token)).data.totals;
        assert.equal(t.visits, 2);
        assert.equal(t.logins, 1, 'visits are not sign-ins');
    });
});

describe('analytics — time in the app', () => {
    test('heartbeats add up', async () => {
        const u = await h.registerUser();
        for (let i = 0; i < 4; i++) assert.equal((await beat(u.token, 30)).status, 200);
        const r = await get(u.token);
        assert.equal(r.data.totals.appSeconds, 120);
        assert.equal(r.data.allTime.appSeconds, 120);
    });

    test('one hour can never hold more than 3600 seconds', async () => {
        const u = await h.registerUser();
        const hourStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
        await h.db.query('INSERT INTO app_usage (user_id, hour_start, seconds) VALUES ($1, $2, $3)', [u.user.id, hourStart, 9999]);
        assert.equal((await get(u.token)).data.totals.appSeconds, 3600);
    });

    test("one student's heartbeats never show up for another", async () => {
        const a = await h.registerUser();
        const b = await h.registerUser();
        await beat(a.token, 60);
        assert.equal((await get(b.token)).data.totals.appSeconds, 0);
    });
});

describe('analytics — sessions and the date filter', () => {
    test('totals, success rate, averages and the daily series add up', async () => {
        const u = await h.registerUser();
        const today = todayUTC();
        const at = (daysAgo, hour) => `${addDays(today, -daysAgo)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
        await insertSession(u.user.id, { endedAt: at(1, 10), duration: 1800, elapsed: 1800, completed: true });
        await insertSession(u.user.id, { endedAt: at(1, 15), duration: 3600, elapsed: 3600, completed: true });
        await insertSession(u.user.id, { endedAt: at(2, 9),  duration: 1500, elapsed: 300,  completed: false });

        const r = await get(u.token, `?from=${addDays(today, -6)}&to=${today}`);
        assert.equal(r.status, 200);
        const t = r.data.totals;
        assert.equal(t.sessions, 3);
        assert.equal(t.completed, 2);
        assert.equal(t.interrupted, 1);
        assert.equal(t.successRate, 67);
        assert.equal(t.focusSeconds, 5400, 'only completed sessions count as focus time');
        assert.equal(t.avgSessionSec, 2700);
        assert.equal(t.longestSessionSec, 3600);
        assert.equal(r.data.daily.length, 7, 'one row per day, including empty days');

        const yesterday = r.data.daily.find(d => d.date === addDays(today, -1));
        assert.equal(yesterday.sessions, 2);
        assert.equal(yesterday.focusSeconds, 5400);
        assert.equal(r.data.recent.length, 3);
        assert.equal(r.data.recent[0].completed, true, 'most recent session first');
    });

    test('sessions outside the chosen dates are left out but counted in all-time', async () => {
        const u = await h.registerUser();
        const today = todayUTC();
        await insertSession(u.user.id, { endedAt: `${addDays(today, -40)}T12:00:00.000Z`, duration: 600, elapsed: 600, completed: true });
        const r = await get(u.token, `?from=${addDays(today, -6)}&to=${today}`);
        assert.equal(r.data.totals.sessions, 0);
        assert.equal(r.data.allTime.sessions, 1);
        assert.equal(r.data.allTime.focusSeconds, 600);
        assert.equal(r.data.totals.successRate, null, 'no sessions → no success rate');
    });

    test('"previous" covers the equally long window just before the range', async () => {
        const u = await h.registerUser();
        const today = todayUTC();
        await insertSession(u.user.id, { endedAt: `${addDays(today, -9)}T12:00:00.000Z`, duration: 600, elapsed: 600, completed: true });
        const r = await get(u.token, `?from=${addDays(today, -6)}&to=${today}`);
        assert.equal(r.data.previous.sessions, 1);
        assert.equal(r.data.totals.sessions, 0);
    });

    test("days follow the student's time zone, not UTC", async () => {
        const u = await h.registerUser();
        // 23:30 UTC on the 10th is already 01:30 on the 11th in Johannesburg (UTC+2)
        await insertSession(u.user.id, { endedAt: '2026-03-10T23:30:00.000Z', duration: 1800, elapsed: 1800, completed: true });
        const utc = await get(u.token, '?from=2026-03-09&to=2026-03-12&tz=UTC');
        const sa = await get(u.token, '?from=2026-03-09&to=2026-03-12&tz=Africa/Johannesburg');
        assert.equal(utc.data.daily.find(d => d.date === '2026-03-10').sessions, 1);
        assert.equal(sa.data.daily.find(d => d.date === '2026-03-11').sessions, 1);
        assert.equal(sa.data.daily.find(d => d.date === '2026-03-10').sessions, 0);
    });

    test('best-time-of-day buckets use the hour a session started', async () => {
        const u = await h.registerUser();
        // ended 21:00, ran 60 min → started 20:00
        await insertSession(u.user.id, { endedAt: '2026-03-10T21:00:00.000Z', duration: 3600, elapsed: 3600, completed: true });
        const r = await get(u.token, '?from=2026-03-10&to=2026-03-10&tz=UTC');
        assert.equal(r.data.byHour.length, 24);
        assert.equal(r.data.byHour[20].sessions, 1);
        assert.equal(r.data.byHour[20].focusSeconds, 3600);
        assert.equal(r.data.byHour[21].sessions, 0);
    });

    test('a brand-new account gets a full, zeroed response', async () => {
        const u = await h.registerUser();
        const r = await get(u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.range.days, 30);
        assert.equal(r.data.daily.length, 30);
        assert.equal(r.data.totals.sessions, 0);
        assert.equal(r.data.recent.length, 0);
    });
});
