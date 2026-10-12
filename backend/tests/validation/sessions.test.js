// Validation: focus sessions — input checking, coin maths, streaks and the
// "one house per 45 cumulative minutes" rule shared with the frontend (App.jsx).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);

const post = (token, body) => h.req('POST', '/api/sessions', body, token);

describe('POST /api/sessions — input validation', () => {
    const bad = [
        ['missing duration',              { elapsed: 10, completed: false }],
        ['zero duration',                 { duration: 0, elapsed: 0, completed: false }],
        ['negative duration',             { duration: -60, elapsed: 0, completed: false }],
        ['duration as a string',          { duration: '1500', elapsed: 1500, completed: true }],
        ['duration over 24h',             { duration: 90000, elapsed: 0, completed: false }],
        ['fractional duration',           { duration: 1500.5, elapsed: 0, completed: false }],
        ['missing elapsed',               { duration: 1500, completed: false }],
        ['negative elapsed',              { duration: 1500, elapsed: -1, completed: false }],
        ['elapsed greater than duration', { duration: 600, elapsed: 601, completed: false }],
        ['completed as the string "false" (would be truthy)', { duration: 1500, elapsed: 1500, completed: 'false' }],
        ['completed=true but session cut short', { duration: 2700, elapsed: 60, completed: true }],
    ];
    for (const [label, body] of bad) {
        test(`rejects ${label} with 400`, async () => {
            const u = await h.registerUser();
            const r = await post(u.token, body);
            assert.equal(r.status, 400, `${label}: expected 400, got ${r.status} ${JSON.stringify(r.data)}`);
            const me = await h.db.user(u.user.id);
            assert.equal(me.coins, 100, 'no coins awarded for a rejected session');
        });
    }

    test('requires authentication', async () => {
        const r = await post(undefined, { duration: 1500, elapsed: 1500, completed: true });
        assert.equal(r.status, 401);
    });
});

describe('POST /api/sessions — rewards', () => {
    test('completed 25-minute session: 25 coins + streak bonus, streak starts at 1', async () => {
        const u = await h.registerUser();
        const r = await post(u.token, { duration: 1500, elapsed: 1500, completed: true });
        assert.equal(r.status, 201);
        assert.equal(r.data.coinsEarned, 25, 'streak is 0 before the first session → no bonus');
        const me = await h.db.user(u.user.id);
        assert.equal(me.coins, 125);
        assert.equal(me.streak, 1);
        assert.equal(me.total_focus_sec, 1500);
    });

    test('interrupted session earns nothing and does not touch streak/total', async () => {
        const u = await h.registerUser();
        const r = await post(u.token, { duration: 1500, elapsed: 300, completed: false });
        assert.equal(r.status, 201);
        assert.equal(r.data.coinsEarned, 0);
        const me = await h.db.user(u.user.id);
        assert.equal(me.coins, 100);
        assert.equal(me.streak, 0);
        assert.equal(me.total_focus_sec, 0);
    });

    test('a second session on the same day keeps the streak at 1', async () => {
        const u = await h.registerUser();
        await post(u.token, { duration: 600, elapsed: 600, completed: true });
        await post(u.token, { duration: 600, elapsed: 600, completed: true });
        assert.equal((await h.db.user(u.user.id)).streak, 1);
    });

    test('a session the day after the last one extends the streak', async () => {
        const u = await h.registerUser();
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
        await h.db.query('UPDATE users SET streak = 4, last_focus_date = $1 WHERE id = $2', [yesterday, u.user.id]);
        const r = await post(u.token, { duration: 600, elapsed: 600, completed: true });
        assert.equal(r.data.coinsEarned, 10 + 20, '10 base coins + streak 4 × 5 bonus');
        assert.equal((await h.db.user(u.user.id)).streak, 5);
    });

    test('a gap of more than one day resets the streak to 1', async () => {
        const u = await h.registerUser();
        await h.db.query("UPDATE users SET streak = 9, last_focus_date = '2020-01-01' WHERE id = $1", [u.user.id]);
        await post(u.token, { duration: 600, elapsed: 600, completed: true });
        assert.equal((await h.db.user(u.user.id)).streak, 1);
    });

    test('streak bonus is capped at 50 coins', async () => {
        const u = await h.registerUser();
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
        await h.db.query('UPDATE users SET streak = 40, last_focus_date = $1 WHERE id = $2', [yesterday, u.user.id]);
        const r = await post(u.token, { duration: 300, elapsed: 300, completed: true });
        assert.equal(r.data.coinsEarned, 5 + 50);
    });
});

describe('Cumulative house building (45 focus-minutes per house)', () => {
    test('three 15-minute sessions add up to exactly one house', async () => {
        const u = await h.registerUser();
        for (let i = 0; i < 3; i++) {
            await post(u.token, { duration: 900, elapsed: 900, completed: true });
        }
        const me = await h.db.user(u.user.id);
        assert.equal(me.total_focus_sec, 2700);
        assert.equal(me.houses_built, 1, `houses_built was ${me.houses_built} after 45 cumulative minutes`);
    });

    test('25 + 25 minutes = one house (crosses the 45-minute line on the 2nd session)', async () => {
        const u = await h.registerUser();
        await post(u.token, { duration: 1500, elapsed: 1500, completed: true });
        assert.equal((await h.db.user(u.user.id)).houses_built, 0);
        await post(u.token, { duration: 1500, elapsed: 1500, completed: true });
        assert.equal((await h.db.user(u.user.id)).houses_built, 1);
    });

    test('a single 90-minute session builds two houses', async () => {
        const u = await h.registerUser();
        await post(u.token, { duration: 5400, elapsed: 5400, completed: true });
        assert.equal((await h.db.user(u.user.id)).houses_built, 2);
    });
});

describe('GET /api/sessions & /api/sessions/stats', () => {
    test('history lists sessions newest first with real booleans', async () => {
        const u = await h.registerUser();
        await post(u.token, { duration: 600, elapsed: 600, completed: true });
        await post(u.token, { duration: 600, elapsed: 100, completed: false });
        const r = await h.req('GET', '/api/sessions', undefined, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.total, 2);
        assert.equal(typeof r.data.sessions[0].completed, 'boolean');
    });

    test('negative / junk paging parameters do not crash the query', async () => {
        const u = await h.registerUser();
        for (const qs of ['?limit=-5', '?offset=-10', '?limit=abc&offset=xyz', '?limit=100000']) {
            const r = await h.req('GET', `/api/sessions${qs}`, undefined, u.token);
            assert.equal(r.status, 200, `${qs} → ${r.status} ${JSON.stringify(r.data)}`);
            assert.ok(r.data.limit >= 1 && r.data.limit <= 100, `${qs} limit clamped (${r.data.limit})`);
            assert.ok(r.data.offset >= 0, `${qs} offset clamped (${r.data.offset})`);
        }
    });

    test('stats for a user with no sessions are numbers, not null', async () => {
        const u = await h.registerUser();
        const r = await h.req('GET', '/api/sessions/stats', undefined, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.completedSessions, 0);
        assert.equal(r.data.failedSessions, 0);
        assert.equal(r.data.successRate, 100);
    });

    test('stats count completed vs failed correctly', async () => {
        const u = await h.registerUser();
        await post(u.token, { duration: 600, elapsed: 600, completed: true });
        await post(u.token, { duration: 600, elapsed: 100, completed: false });
        const r = await h.req('GET', '/api/sessions/stats', undefined, u.token);
        assert.equal(r.data.completedSessions, 1);
        assert.equal(r.data.failedSessions, 1);
        assert.equal(r.data.successRate, 50);
        assert.equal(r.data.totalFocusTime, 600);
    });
});
