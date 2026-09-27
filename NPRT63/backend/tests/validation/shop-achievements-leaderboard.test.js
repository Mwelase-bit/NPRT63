// Validation: shop purchases, achievements and leaderboards
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);

describe('Shop', () => {
    test('catalogue is grouped by category with ownership flags', async () => {
        const u = await h.registerUser();
        const r = await h.req('GET', '/api/shop', undefined, u.token);
        assert.equal(r.status, 200);
        for (const cat of ['outfit', 'hat', 'tool', 'house', 'booster']) {
            assert.ok(Array.isArray(r.data.categories[cat]) && r.data.categories[cat].length > 0, `category ${cat}`);
        }
        const palace = r.data.categories.house.find(i => i.itemId === 'house_palace');
        assert.equal(palace.isPremium, true);
        assert.equal(palace.owned, false);
    });

    test('buying deducts the price and returns the new balance', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        const r = await h.req('POST', '/api/shop/buy', { itemId: 'hat_beanie' }, u.token); // 120 coins
        assert.equal(r.status, 201);
        assert.equal(r.data.coinsRemaining, 380);
        assert.equal((await h.db.user(u.user.id)).coins, 380);
    });

    test('cannot buy the same item twice', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 1000);
        assert.equal((await h.req('POST', '/api/shop/buy', { itemId: 'hat_beanie' }, u.token)).status, 201);
        const again = await h.req('POST', '/api/shop/buy', { itemId: 'hat_beanie' }, u.token);
        assert.equal(again.status, 409);
        assert.equal((await h.db.user(u.user.id)).coins, 1000 - 120, 'charged only once');
    });

    test('cannot buy what you cannot afford (402) and balance is unchanged', async () => {
        const u = await h.registerUser();
        const r = await h.req('POST', '/api/shop/buy', { itemId: 'house_palace' }, u.token);
        assert.equal(r.status, 402);
        assert.equal((await h.db.user(u.user.id)).coins, 100);
    });

    test('unknown item → 404, missing item → 400', async () => {
        const u = await h.registerUser();
        assert.equal((await h.req('POST', '/api/shop/buy', { itemId: 'hat_unicorn' }, u.token)).status, 404);
        assert.equal((await h.req('POST', '/api/shop/buy', {}, u.token)).status, 400);
    });

    test('non-string itemId (object/array) → 400, not a 500', async () => {
        const u = await h.registerUser();
        for (const itemId of [{ $ne: null }, ['hat_beanie'], 42]) {
            const r = await h.req('POST', '/api/shop/buy', { itemId }, u.token);
            assert.equal(r.status, 400, `itemId=${JSON.stringify(itemId)} → ${r.status}`);
        }
    });

    test('two simultaneous purchases can never overdraw the balance', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 200); // enough for ONE of these, not both
        const [a, b] = await Promise.all([
            h.req('POST', '/api/shop/buy', { itemId: 'hat_beanie' }, u.token),     // 120
            h.req('POST', '/api/shop/buy', { itemId: 'booster_streak' }, u.token)  // 150
        ]);
        assert.deepEqual([a.status, b.status].sort(), [201, 402]);
        const coins = (await h.db.user(u.user.id)).coins;
        assert.ok(coins === 80 || coins === 50, `balance ${coins}`);
    });

    test('owned list reflects purchases', async () => {
        const u = await h.registerUser();
        await h.db.setCoins(u.user.id, 500);
        await h.req('POST', '/api/shop/buy', { itemId: 'hat_beanie' }, u.token);
        const r = await h.req('GET', '/api/shop/owned', undefined, u.token);
        assert.deepEqual(r.data.owned.map(o => o.item_id), ['hat_beanie']);
    });
});

describe('Achievements', () => {
    test('unlock is idempotent', async () => {
        const u = await h.registerUser();
        let r = await h.req('POST', '/api/achievements/unlock', { achievementId: 'first_session' }, u.token);
        assert.equal(r.status, 201);
        assert.equal(r.data.alreadyUnlocked, false);
        r = await h.req('POST', '/api/achievements/unlock', { achievementId: 'first_session' }, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.alreadyUnlocked, true);
        r = await h.req('GET', '/api/achievements', undefined, u.token);
        assert.equal(r.data.achievements.length, 1);
    });

    test('rejects missing / non-string / absurdly long ids', async () => {
        const u = await h.registerUser();
        for (const achievementId of [undefined, 7, 'x'.repeat(500)]) {
            const r = await h.req('POST', '/api/achievements/unlock', { achievementId }, u.token);
            assert.equal(r.status, 400, `achievementId=${String(achievementId).slice(0, 20)} → ${r.status}`);
        }
    });
});

describe('Leaderboards', () => {
    test('faculty board ranks by weekly focus and flags the current user', async () => {
        const a = await h.registerUser({ faculty: 'hum' });
        const b = await h.registerUser({ faculty: 'hum' });
        await h.req('POST', '/api/sessions', { duration: 600, elapsed: 600, completed: true }, a.token);
        await h.req('POST', '/api/sessions', { duration: 1800, elapsed: 1800, completed: true }, b.token);
        const r = await h.req('GET', '/api/leaderboard/faculty', undefined, a.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.faculty, 'hum');
        assert.equal(r.data.leaderboard[0].id, b.user.id);
        assert.equal(r.data.leaderboard.find(x => x.id === a.user.id).isCurrentUser, true);
    });

    test('interfaculty, global and summary respond with sane shapes', async () => {
        const u = await h.registerUser();
        const inter = await h.req('GET', '/api/leaderboard/interfaculty', undefined, u.token);
        assert.equal(inter.status, 200);
        assert.ok(inter.data.rankings.every(x => Number.isFinite(x.totalHours)));
        const global = await h.req('GET', '/api/leaderboard/global', undefined, u.token);
        assert.equal(global.status, 200);
        assert.ok(global.data.leaderboard.length <= 50);
        const summary = await h.req('GET', '/api/leaderboard/summary', undefined, u.token);
        assert.equal(summary.status, 200);
        assert.ok(summary.data.totalMembers >= 1);
    });

    test('leaderboards never expose emails or password hashes', async () => {
        const u = await h.registerUser();
        for (const p of ['/api/leaderboard/faculty', '/api/leaderboard/global']) {
            const body = JSON.stringify((await h.req('GET', p, undefined, u.token)).data);
            assert.ok(!body.includes('@spu.ac.za'), `${p} leaks emails`);
            assert.ok(!body.includes('$2'), `${p} leaks bcrypt hashes`);
        }
    });
});
