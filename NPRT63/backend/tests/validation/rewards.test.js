// Validation: server-checked reward claims, streak milestone coins, and shop boosters
// (Focus Potion, XP Amplifier, Streak Shield).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');
const rules = require('../../utils/rewardRules');

before(h.start);
after(h.stop);

const R = (method, p, body, token) => h.req(method, `/api/rewards${p}`, body, token);
const status = async (u) => (await R('GET', '/status', undefined, u.token)).data;
const claim = (u, kind) => R('POST', '/claim', { kind }, u.token);
const coins = async (u) => (await h.db.user(u.user.id)).coins;
const day = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const when = (daysAgo, hour = 12) => { const d = new Date(Date.now() - daysAgo * 86400000); d.setUTCHours(hour, 0, 0, 0); return d.toISOString(); };
const addSessions = (u, n, { daysAgo = 0, elapsed = 600 } = {}) => Promise.all(Array.from({ length: n }, () => h.db.query(
    'INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned, created_at) VALUES ($1,$2,$3,TRUE,0,$4)', [u.user.id, elapsed, elapsed, when(daysAgo)])));
const finish = (u, seconds = 600) => h.req('POST', '/api/sessions', { duration: seconds, elapsed: seconds, completed: true }, u.token);
const buy = (u, itemId) => h.req('POST', '/api/shop/buy', { itemId }, u.token);

describe('reward rules (pure helpers)', () => {
    test('ISO weeks start on Monday and follow the Thursday rule', () => {
        assert.deepEqual(rules.weekInfo(new Date('2026-10-15T10:00:00Z')), { key: '2026-W42', start: '2026-10-12' });
        assert.deepEqual(rules.weekInfo(new Date('2026-10-12T00:00:00Z')), { key: '2026-W42', start: '2026-10-12' });
        assert.deepEqual(rules.weekInfo(new Date('2026-10-18T23:59:00Z')), { key: '2026-W42', start: '2026-10-12' }, 'Sunday still belongs to the same week');
        assert.deepEqual(rules.weekInfo(new Date('2025-12-29T12:00:00Z')), { key: '2026-W01', start: '2025-12-29' }, 'late December can be week 1 of the next year');
        assert.deepEqual(rules.weekInfo(new Date('2027-01-03T12:00:00Z')), { key: '2026-W53', start: '2026-12-28' });
    });

    test('milestone coins match what the Rewards screen advertises', () => {
        assert.deepEqual(rules.STREAK_MILESTONE_COINS, { 3: 30, 7: 70, 14: 140, 30: 300, 50: 500, 100: 1000 });
    });
});

describe('rewards - status and claims', () => {
    test('endpoints need a sign-in', async () => {
        assert.equal((await R('GET', '/status')).status, 401);
        assert.equal((await R('POST', '/claim', { kind: 'daily_login' })).status, 401);
    });

    test('a new student: only the daily check-in is available', async () => {
        const u = await h.registerUser();
        const s = await status(u);
        assert.deepEqual([s.claims.daily_login.eligible, s.claims.daily_login.claimed], [true, false]);
        assert.equal(s.claims.daily_progress.eligible, false);
        assert.equal(s.claims.weekly_challenge.eligible, false);
        assert.deepEqual(s.boosters, { focus_potion: 0, streak_shield: 0, xp_amplifier: 0 });
        assert.deepEqual(s.milestones.map(m => m.days), [3, 7, 14, 30, 50, 100]);
        assert.equal(s.progress.weeklyTarget, 20);
    });

    test('daily check-in pays 50 coins once a day, and the coins stay after a re-sync', async () => {
        const u = await h.registerUser();
        const r = await claim(u, 'daily_login');
        assert.deepEqual([r.status, r.data.coins, r.data.balance], [201, 50, 150]);
        assert.equal(await coins(u), 150, 'saved on the server, not just in the browser');
        assert.equal((await claim(u, 'daily_login')).status, 409);
        assert.equal(await coins(u), 150);
        assert.equal((await status(u)).claims.daily_login.claimed, true);
    });

    test('two claims at the same instant pay once', async () => {
        const u = await h.registerUser();
        const [a, b] = await Promise.all([claim(u, 'daily_login'), claim(u, 'daily_login')]);
        assert.deepEqual([a.status, b.status].sort(), [201, 409]);
        assert.equal(await coins(u), 150);
    });

    for (const [label, body] of [['no kind', {}], ['an unknown kind', { kind: 'free_money' }], ['a number', { kind: 5 }], ['an object', { kind: { $ne: 1 } }]]) {
        test(`rejects ${label}`, async () => {
            const u = await h.registerUser();
            assert.equal((await R('POST', '/claim', body, u.token)).status, 400);
        });
    }

    test('the daily goal needs 5 sessions or 120 minutes TODAY, and pays 200 once', async () => {
        const u = await h.registerUser();
        assert.equal((await claim(u, 'daily_progress')).status, 403);
        await addSessions(u, 4);
        assert.equal((await claim(u, 'daily_progress')).status, 403, '4 short sessions is not enough');
        await addSessions(u, 1);
        const ok = await claim(u, 'daily_progress');
        assert.deepEqual([ok.status, ok.data.coins, ok.data.balance], [201, 200, 300]);
        assert.equal((await claim(u, 'daily_progress')).status, 409);
    });

    test('120 minutes in a single session also earns the daily goal', async () => {
        const u = await h.registerUser();
        await addSessions(u, 1, { elapsed: 7200 });
        assert.equal((await claim(u, 'daily_progress')).status, 201);
    });

    test("yesterday's sessions do not count towards today's goal", async () => {
        const u = await h.registerUser();
        await addSessions(u, 6, { daysAgo: 1 });
        assert.equal((await claim(u, 'daily_progress')).status, 403);
    });

    test('an interrupted session never counts', async () => {
        const u = await h.registerUser();
        for (let i = 0; i < 6; i++) await h.db.query('INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned) VALUES ($1, 600, 100, FALSE, 0)', [u.user.id]);
        assert.equal((await claim(u, 'daily_progress')).status, 403);
    });

    test('the weekly challenge needs 20 sessions this ISO week, and pays 500 once', async () => {
        const u = await h.registerUser();
        assert.equal((await claim(u, 'weekly_challenge')).status, 403);
        // sessions from before this week do not count
        await addSessions(u, 20, { daysAgo: 9 });
        assert.equal((await claim(u, 'weekly_challenge')).status, 403, 'last week does not count');
        await addSessions(u, 20, { daysAgo: 0 });
        const ok = await claim(u, 'weekly_challenge');
        assert.deepEqual([ok.status, ok.data.coins, ok.data.balance], [201, 500, 600]);
        assert.equal((await claim(u, 'weekly_challenge')).status, 409);
        assert.equal((await status(u)).claims.weekly_challenge.claimed, true);
    });
});

describe('streak milestones', () => {
    test('reaching 3 days pays a one-off 30 coins on top of the session coins', async () => {
        const u = await h.registerUser();
        await h.db.query('UPDATE users SET streak = 2, last_focus_date = $1 WHERE id = $2', [day(1), u.user.id]);
        const r = await finish(u, 600);       // 10 base + 2*5 streak bonus
        assert.equal(r.data.coinsEarned, 20);
        assert.equal(r.data.milestoneBonus, 30);
        assert.equal(await coins(u), 100 + 20 + 30);
        const again = await finish(u, 600);   // same day: streak unchanged, no second bonus
        assert.equal(again.data.milestoneBonus, 0);
    });

    test('each milestone pays its own amount', async () => {
        for (const [from, bonus] of [[6, 70], [13, 140], [29, 300]]) {
            const u = await h.registerUser();
            await h.db.query('UPDATE users SET streak = $1, last_focus_date = $2 WHERE id = $3', [from, day(1), u.user.id]);
            assert.equal((await finish(u)).data.milestoneBonus, bonus, `streak ${from + 1}`);
        }
    });

    test('non-milestone days pay no bonus, and interrupted sessions never do', async () => {
        const u = await h.registerUser();
        await h.db.query('UPDATE users SET streak = 3, last_focus_date = $1 WHERE id = $2', [day(1), u.user.id]);
        assert.equal((await finish(u)).data.milestoneBonus, 0, 'day 4');
        const v = await h.registerUser();
        await h.db.query('UPDATE users SET streak = 2, last_focus_date = $1 WHERE id = $2', [day(1), v.user.id]);
        const r = await h.req('POST', '/api/sessions', { duration: 600, elapsed: 60, completed: false }, v.token);
        assert.equal(r.data.milestoneBonus, 0);
    });
});

describe('boosters', () => {
    test('boosters can be bought again and again, and show their charges in the shop', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 1000);
        assert.equal((await buy(u, 'booster_focus')).status, 201);
        assert.equal((await buy(u, 'booster_focus')).status, 201, 'a second potion is allowed');
        assert.equal((await buy(u, 'booster_xp')).status, 201);
        const shop = (await h.req('GET', '/api/shop', undefined, u.token)).data.categories.booster;
        const by = Object.fromEntries(shop.map(i => [i.itemId, i]));
        assert.equal(by.booster_focus.charges, 2);
        assert.equal(by.booster_xp.charges, 3);
        assert.equal(by.booster_streak.charges, 0);
        assert.ok(shop.every(i => i.owned === false), 'consumables are never "owned"');
        assert.equal(await coins(u), 1000 - 100 - 100 - 200);
        assert.equal((await status(u)).boosters.focus_potion, 2);
    });

    test('a booster is not bought without enough coins', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 50);
        assert.equal((await buy(u, 'booster_focus')).status, 402);
        assert.equal((await status(u)).boosters.focus_potion, 0);
    });

    test('Focus Potion doubles the next completed session once', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        await buy(u, 'booster_focus');
        const first = await finish(u, 1200);           // 20 base (streak 0)
        assert.deepEqual([first.data.coinsEarned, first.data.boosterUsed], [40, 'focus_potion']);
        const second = await finish(u, 1200);
        assert.deepEqual([second.data.coinsEarned, second.data.boosterUsed], [20 + 5, null], 'the charge is gone (and the streak bonus now applies)');
        assert.equal((await status(u)).boosters.focus_potion, 0);
    });

    test('an interrupted session does not use up a booster', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        await buy(u, 'booster_focus');
        await h.req('POST', '/api/sessions', { duration: 1200, elapsed: 200, completed: false }, u.token);
        assert.equal((await status(u)).boosters.focus_potion, 1);
    });

    test('XP Amplifier adds 50% for three sessions, then stops', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        await buy(u, 'booster_xp');
        // keep the streak out of the way so the maths is plain
        const results = [];
        for (let i = 0; i < 4; i++) { await h.db.query('UPDATE users SET streak = 0, last_focus_date = NULL WHERE id = $1', [u.user.id]); results.push(await finish(u, 1200)); }
        assert.deepEqual(results.map(r => r.data.coinsEarned), [30, 30, 30, 20]);
        assert.deepEqual(results.map(r => r.data.boosterUsed), ['xp_amplifier', 'xp_amplifier', 'xp_amplifier', null]);
    });

    test('with both, the Focus Potion goes first and the XP Amplifier keeps its charges', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 1000);
        await buy(u, 'booster_focus'); await buy(u, 'booster_xp');
        const r = await finish(u, 1200);
        assert.deepEqual([r.data.coinsEarned, r.data.boosterUsed], [40, 'focus_potion']);
        assert.equal((await status(u)).boosters.xp_amplifier, 3);
    });

    test('Streak Shield saves a streak after exactly one missed day, and is used up', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        await buy(u, 'booster_streak');
        await h.db.query('UPDATE users SET streak = 5, last_focus_date = $1 WHERE id = $2', [day(2), u.user.id]);
        const r = await finish(u);
        assert.equal(r.data.shieldUsed, true);
        assert.equal((await h.db.user(u.user.id)).streak, 6);
        assert.equal((await status(u)).boosters.streak_shield, 0);
    });

    test('without a shield the same gap resets the streak', async () => {
        const u = await h.registerUser();
        await h.db.query('UPDATE users SET streak = 5, last_focus_date = $1 WHERE id = $2', [day(2), u.user.id]);
        const r = await finish(u);
        assert.equal(r.data.shieldUsed, false);
        assert.equal((await h.db.user(u.user.id)).streak, 1);
    });

    test('a shield cannot cover two or more missed days, and is kept when not needed', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        await buy(u, 'booster_streak');
        await h.db.query('UPDATE users SET streak = 5, last_focus_date = $1 WHERE id = $2', [day(3), u.user.id]);
        assert.equal((await finish(u)).data.shieldUsed, false);
        assert.equal((await h.db.user(u.user.id)).streak, 1);
        assert.equal((await status(u)).boosters.streak_shield, 1, 'the charge is still there');
        // a normal next-day session does not use it either
        await h.db.query('UPDATE users SET streak = 2, last_focus_date = $1 WHERE id = $2', [day(1), u.user.id]);
        assert.equal((await finish(u)).data.shieldUsed, false);
        assert.equal((await status(u)).boosters.streak_shield, 1);
    });
});
