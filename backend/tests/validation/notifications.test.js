// Validation: notifications (in-app list, switches, Web Push delivery) and the
// saved character appearance.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const h = require('../helpers/harness');

let notify;     // the app's own notify module (loaded after the test database is in place)
let pushed;     // every push message the fake sender received

before(async () => {
    await h.start();
    notify = require(path.join(__dirname, '..', '..', 'utils', 'notify.js'));
    notify.setSender(async (sub, payload) => {
        if (sub.endpoint.includes('gone')) { const e = new Error('Gone'); e.statusCode = 410; throw e; }
        if (sub.endpoint.includes('flaky')) { throw new Error('network down'); }
        pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    });
});
after(h.stop);
beforeEach(() => { pushed = []; notify.resetBroadcastLimits(); });

const N = (method, p, body, token) => h.req(method, `/api/notifications${p}`, body, token);
const S = (method, p, body, token) => h.req(method, `/api/social${p}`, body, token);
const list = async (u) => (await N('GET', '', undefined, u.token)).data;
const titles = async (u) => (await list(u)).notifications.map(n => n.title);

const sub = (name) => ({ endpoint: `https://push.example.com/${name}-${Math.random().toString(36).slice(2)}`, keys: { p256dh: 'BKey' + 'x'.repeat(40), auth: 'authkey123' } });
async function subscribe(u, name = 'ok') {
    const s = sub(name);
    const r = await N('POST', '/push/subscribe', s, u.token);
    assert.equal(r.status, 201);
    return s;
}
async function befriend(a, b) {
    const code = (await S('GET', '/me', undefined, b.token)).data.code;
    await S('POST', '/friends/request', { code }, a.token);
    await S('POST', `/friends/${a.user.id}/accept`, {}, b.token);
}

describe('notifications - basics', () => {
    test('every endpoint needs a sign-in', async () => {
        for (const [m, p] of [['GET', ''], ['POST', '/read'], ['DELETE', ''], ['GET', '/prefs'], ['PUT', '/prefs'], ['GET', '/push/key'], ['POST', '/push/subscribe'], ['POST', '/push/unsubscribe']]) {
            assert.equal((await N(m, p, m === 'GET' || m === 'DELETE' ? undefined : {})).status, 401, `${m} ${p}`);
        }
    });

    test('a new student has an empty list and zero unread', async () => {
        const u = await h.registerUser();
        const r = await list(u);
        assert.deepEqual([r.notifications.length, r.unread], [0, 0]);
    });

    test('a friend request notifies the person asked, and nobody else', async () => {
        const [a, b, c] = [await h.registerUser({ name: 'Asker A' }), await h.registerUser(), await h.registerUser()];
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, a.token);
        const got = await list(b);
        assert.equal(got.unread, 1);
        assert.equal(got.notifications[0].title, 'Asker A sent you a friend request');
        assert.equal(got.notifications[0].link, 'community:friends');
        assert.equal(got.notifications[0].category, 'friends');
        assert.equal((await list(a)).notifications.length, 0, 'the sender is not notified');
        assert.equal((await list(c)).notifications.length, 0, 'a stranger is not notified');
    });

    test('accepting notifies the original requester', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser({ name: 'Bea B' })];
        await befriend(a, b);
        assert.ok((await titles(a)).includes('Bea B accepted your friend request'));
    });

    test('marking read: by ids, all, and bad input', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        await befriend(a, b);
        await S('POST', '/groups', { name: 'Read test' }, a.token);
        const before = await list(a);
        assert.ok(before.unread >= 1);
        const first = before.notifications[0].id;
        assert.equal((await N('POST', '/read', { ids: [first] }, a.token)).status, 200);
        assert.equal((await list(a)).notifications.find(n => n.id === first).read, true);
        assert.equal((await N('POST', '/read', { all: true }, a.token)).status, 200);
        assert.equal((await list(a)).unread, 0);
        for (const bad of [{}, { ids: [] }, { ids: ['x'] }, { ids: [1.5] }, { ids: Array(101).fill(1) }, { all: 'yes' }]) {
            assert.equal((await N('POST', '/read', bad, a.token)).status, 400, JSON.stringify(bad).slice(0, 40));
        }
    });

    test("you cannot mark someone else's notification as read", async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, a.token);
        const id = (await list(b)).notifications[0].id;
        await N('POST', '/read', { ids: [id] }, a.token);
        assert.equal((await list(b)).unread, 1);
    });

    test('clearing removes only my notifications', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        await befriend(a, b);
        assert.equal((await N('DELETE', '', undefined, a.token)).status, 200);
        assert.equal((await list(a)).notifications.length, 0);
        assert.ok((await list(b)).notifications.length >= 1);
    });

    test('the list is newest first and capped', async () => {
        const u = await h.registerUser();
        for (let i = 0; i < 5; i++) await h.db.query("INSERT INTO notifications (user_id, category, kind, title) VALUES ($1, 'system', 'x', $2)", [u.user.id, `n${i}`]);
        const r = (await N('GET', '?limit=3', undefined, u.token)).data;
        assert.deepEqual(r.notifications.map(n => n.title), ['n4', 'n3', 'n2']);
        assert.equal(r.unread, 5);
        assert.equal((await N('GET', '?limit=9999', undefined, u.token)).data.notifications.length, 5);
    });
});

describe('notifications - category switches', () => {
    test('all five categories start on', async () => {
        const u = await h.registerUser();
        const r = (await N('GET', '/prefs', undefined, u.token)).data.prefs;
        assert.deepEqual(r.map(p => p.id).sort(), ['achievements', 'friends', 'groups', 'rooms', 'system']);
        assert.ok(r.every(p => p.enabled === true));
    });

    test('switching a category off stops those notifications (and push), on brings them back', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        await subscribe(b);
        assert.equal((await N('PUT', '/prefs', { category: 'friends', enabled: false }, b.token)).status, 200);
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, a.token);
        assert.equal((await list(b)).notifications.length, 0);
        assert.equal(pushed.length, 0);
        assert.equal((await N('GET', '/prefs', undefined, b.token)).data.prefs.find(p => p.id === 'friends').enabled, false);
        await N('PUT', '/prefs', { category: 'friends', enabled: true }, b.token);
        const c = await h.registerUser();
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, c.token);
        assert.equal((await list(b)).notifications.length, 1);
        assert.equal(pushed.length, 1);
    });

    test('bad switch requests are rejected', async () => {
        const u = await h.registerUser();
        assert.equal((await N('PUT', '/prefs', { category: 'nope', enabled: true }, u.token)).status, 400);
        assert.equal((await N('PUT', '/prefs', { category: 'friends', enabled: 'false' }, u.token)).status, 400);
        assert.equal((await N('PUT', '/prefs', {}, u.token)).status, 400);
    });
});

describe('web push - subscriptions and delivery', () => {
    test('the key endpoint answers without an error even when push is not configured', async () => {
        const u = await h.registerUser();
        const r = await N('GET', '/push/key', undefined, u.token);
        assert.equal(r.status, 200);
        assert.equal(typeof r.data.enabled, 'boolean');
    });

    for (const [label, body] of [
        ['no body', {}], ['an http (not https) endpoint', { endpoint: 'http://x.example.com/abc123456', keys: { p256dh: 'a', auth: 'b' } }],
        ['missing keys', { endpoint: 'https://x.example.com/abc123456' }], ['key too long', { endpoint: 'https://x.example.com/abc123456', keys: { p256dh: 'a'.repeat(300), auth: 'b' } }],
        ['keys as numbers', { endpoint: 'https://x.example.com/abc123456', keys: { p256dh: 1, auth: 2 } }]
    ]) {
        test(`rejects a subscription with ${label}`, async () => {
            const u = await h.registerUser();
            assert.equal((await N('POST', '/push/subscribe', body, u.token)).status, 400);
        });
    }

    test('the same browser subscribing twice keeps one row; a device cap applies', async () => {
        const u = await h.registerUser();
        const s = sub('dup');
        await N('POST', '/push/subscribe', s, u.token);
        await N('POST', '/push/subscribe', s, u.token);
        assert.equal((await h.db.query('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = $1', [u.user.id])).rows[0].n, 1);
        for (let i = 0; i < 9; i++) await N('POST', '/push/subscribe', sub('dev' + i), u.token);
        assert.equal((await N('POST', '/push/subscribe', sub('eleventh'), u.token)).status, 400);
    });

    test('a push reaches every subscribed device with the notification text', async () => {
        const [a, b] = [await h.registerUser({ name: 'Sender S' }), await h.registerUser()];
        const s1 = await subscribe(b), s2 = await subscribe(b);
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, a.token);
        assert.deepEqual(pushed.map(p => p.endpoint).sort(), [s1.endpoint, s2.endpoint].sort());
        assert.equal(pushed[0].payload.title, 'Sender S sent you a friend request');
        assert.equal(pushed[0].payload.link, 'community:friends');
    });

    test('a browser that has dropped its subscription (410) is forgotten; other failures keep it', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        await subscribe(b, 'gone');
        await subscribe(b, 'flaky');
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, a.token);
        const left = (await h.db.query('SELECT endpoint FROM push_subscriptions WHERE user_id = $1', [b.user.id])).rows.map(r => r.endpoint);
        assert.equal(left.length, 1);
        assert.ok(left[0].includes('flaky'));
        assert.equal((await list(b)).notifications.length, 1, 'the in-app notification exists regardless');
    });

    test('unsubscribing stops pushes', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const s = await subscribe(b);
        assert.equal((await N('POST', '/push/unsubscribe', { endpoint: s.endpoint }, b.token)).status, 200);
        await S('POST', '/friends/request', { code: (await S('GET', '/me', undefined, b.token)).data.code }, a.token);
        assert.equal(pushed.length, 0);
        assert.equal((await N('POST', '/push/unsubscribe', {}, b.token)).status, 400);
    });

    test("one student cannot unsubscribe another student's device", async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const s = await subscribe(b);
        await N('POST', '/push/unsubscribe', { endpoint: s.endpoint }, a.token);
        assert.equal((await h.db.query('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = $1', [b.user.id])).rows[0].n, 1);
    });
});

describe('notifications - when friends study', () => {
    test('starting a session notifies friends, but not strangers, and only once per 10 minutes', async () => {
        const [me, friend, stranger] = [await h.registerUser({ name: 'Starter S' }), await h.registerUser(), await h.registerUser()];
        await befriend(me, friend);
        await subscribe(friend);
        const r = await h.req('POST', '/api/sessions/start', { duration: 2700 }, me.token);
        assert.deepEqual([r.status, r.data.notified], [200, 1]);
        assert.ok((await titles(friend)).includes('Starter S started a 45 min session'));
        assert.equal((await list(stranger)).notifications.length, 0);
        assert.equal(pushed.length, 1);
        const again = await h.req('POST', '/api/sessions/start', { duration: 1500 }, me.token);
        assert.equal(again.data.notified, 0, 'the second start inside 10 minutes is quiet');
    });

    test('a session start with a bad duration is rejected', async () => {
        const u = await h.registerUser();
        for (const duration of [0, -5, 90000, 10.5, '60', undefined]) {
            assert.equal((await h.req('POST', '/api/sessions/start', { duration }, u.token)).status, 400, String(duration));
        }
        assert.equal((await h.req('POST', '/api/sessions/start', { duration: 60 })).status, 401);
    });

    test('finishing a session tells friends; a friend with "friends" switched off hears nothing', async () => {
        const [me, f1, f2] = [await h.registerUser({ name: 'Finisher F' }), await h.registerUser(), await h.registerUser()];
        await befriend(me, f1); await befriend(me, f2);
        await N('PUT', '/prefs', { category: 'friends', enabled: false }, f2.token);
        const base = (await list(f1)).notifications.length;
        const r = await h.req('POST', '/api/sessions', { duration: 1800, elapsed: 1800, completed: true }, me.token);
        assert.equal(r.status, 201);
        assert.ok((await titles(f1)).includes('Finisher F finished a 30 min session'));
        assert.equal((await list(f1)).notifications.length, base + 1);
        assert.equal((await titles(f2)).some(t => t.includes('finished')), false);
    });

    test('an interrupted session announces nothing', async () => {
        const [me, f] = [await h.registerUser(), await h.registerUser()];
        await befriend(me, f);
        const base = (await list(f)).notifications.length;
        await h.req('POST', '/api/sessions', { duration: 1800, elapsed: 120, completed: false }, me.token);
        assert.equal((await list(f)).notifications.length, base);
    });

    test('reaching a 3-day streak creates an in-app streak notice for the student (no push)', async () => {
        const u = await h.registerUser();
        await subscribe(u);
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        await h.db.query('UPDATE users SET streak = 2, last_focus_date = $1 WHERE id = $2', [yesterday, u.user.id]);
        await h.req('POST', '/api/sessions', { duration: 600, elapsed: 600, completed: true }, u.token);
        assert.ok((await titles(u)).includes('3-day streak'));
        assert.equal(pushed.length, 0, 'own events are in-app only');
    });
});

describe('notifications - study rooms and groups', () => {
    test('opening a room tells friends; joining tells the host; focusing and finishing tell the others', async () => {
        const [host, friend, stranger] = [await h.registerUser({ name: 'Hosty H' }), await h.registerUser({ name: 'Frida F' }), await h.registerUser()];
        await befriend(host, friend);
        const room = (await S('POST', '/rooms', { durationMin: 45, title: 'Calc cram' }, host.token)).data.room;
        assert.ok((await titles(friend)).includes('Hosty H opened a study room'));
        assert.equal((await list(stranger)).notifications.length, 0);

        await S('POST', `/rooms/${room.id}/join`, {}, friend.token);
        assert.ok((await titles(host)).includes('Frida F joined your study room'));

        const hostBefore = (await list(host)).notifications.length;
        await S('POST', `/rooms/${room.id}/status`, { status: 'focusing' }, friend.token);
        assert.ok((await titles(host)).includes('Frida F started focusing'));
        const friendBefore = (await list(friend)).notifications.length;
        await S('POST', `/rooms/${room.id}/status`, { status: 'completed' }, friend.token);
        assert.ok((await titles(host)).includes('Frida F finished their session'));
        assert.equal((await list(friend)).notifications.length, friendBefore, 'you are not notified about your own status');
        assert.ok((await list(host)).notifications.length > hostBefore);
    });

    test('a room linked to a group also notifies group mates who are not friends', async () => {
        const [host, mate] = [await h.registerUser(), await h.registerUser()];
        const g = (await S('POST', '/groups', { name: 'Notify crew' }, host.token)).data.group;
        await S('POST', '/groups/join', { code: g.inviteCode }, mate.token);
        await S('POST', '/rooms', { durationMin: 30, groupId: g.id }, host.token);
        assert.ok((await titles(mate)).some(t => t.includes('opened a study room')));
    });

    test('joining a group notifies its owner', async () => {
        const [owner, s] = [await h.registerUser(), await h.registerUser({ name: 'Joiner J' })];
        const g = (await S('POST', '/groups', { name: 'Owner news' }, owner.token)).data.group;
        await S('POST', '/groups/join', { code: g.inviteCode }, s.token);
        assert.ok((await titles(owner)).includes('Joiner J joined Owner news'));
        await S('POST', '/groups/join', { code: g.inviteCode }, s.token);       // joining again is not news
        assert.equal((await titles(owner)).filter(t => t.includes('Joiner J joined')).length, 1);
    });
});

describe('notifications - own events stay in the app', () => {
    test('unlocking an achievement and buying an item create in-app notices, with no push', async () => {
        const u = await h.registerUser();
        await subscribe(u);
        await h.req('POST', '/api/achievements/unlock', { achievementId: 'first_steps' }, u.token);
        await h.db.setCoins(u.user.id, 1000);
        await h.req('POST', '/api/shop/buy', { itemId: 'hat_beret' }, u.token);
        const t = await titles(u);
        assert.ok(t.includes('Achievement unlocked'));
        assert.ok(t.some(x => x.startsWith('Purchased')));
        assert.equal(pushed.length, 0);
    });
});

describe('saved character appearance', () => {
    const A = (method, body, token) => h.req(method, '/api/users/avatar', body, token);

    test('needs a sign-in; a new student has nothing saved', async () => {
        assert.equal((await A('GET', undefined)).status, 401);
        assert.equal((await A('PUT', { hairStyle: 'short' })).status, 401);
        const u = await h.registerUser();
        const r = await A('GET', undefined, u.token);
        assert.deepEqual([r.status, r.data.avatar, r.data.owned], [200, null, []]);
    });

    test('saving merges field by field and persists', async () => {
        const u = await h.registerUser();
        await A('PUT', { hairStyle: 'spiky', hairColor: '#112233' }, u.token);
        const r = await A('PUT', { glasses: 'round', skinColor: '#C68642' }, u.token);
        assert.deepEqual(r.data.avatar, { hairStyle: 'spiky', hairColor: '#112233', glasses: 'round', skinColor: '#C68642' });
        assert.deepEqual((await A('GET', undefined, u.token)).data.avatar, r.data.avatar);
    });

    for (const [label, body] of [
        ['an empty body', {}], ['an array', [1]], ['an unknown field', { superpower: 'fly' }], ['a colour without #', { hairColor: '112233' }],
        ['a short colour', { skinColor: '#fff' }], ['an unknown hair style', { hairStyle: 'mohawk' }], ['a number for a colour', { eyeColor: 5 }],
        ['an unknown mouth', { mouth: 'frown' }]
    ]) {
        test(`rejects ${label}`, async () => {
            const u = await h.registerUser();
            assert.equal((await A('PUT', body, u.token)).status, 400);
        });
    }

    test('shop items can only be used once bought', async () => {
        const u = await h.registerUser();
        assert.equal((await A('PUT', { hat: 'hat_crown' }, u.token)).status, 403);
        assert.equal((await A('PUT', { outfit: 'outfit_wizard' }, u.token)).status, 403);
        assert.equal((await A('PUT', { hat: 'hardhat', tool: 'hammer', outfit: 'default' }, u.token)).status, 200, 'free items are always allowed');
        await h.db.setCoins(u.user.id, 5000);
        await h.req('POST', '/api/shop/buy', { itemId: 'hat_crown' }, u.token);
        assert.equal((await A('PUT', { hat: 'hat_crown' }, u.token)).status, 200);
        assert.ok((await A('GET', undefined, u.token)).data.owned.includes('hat_crown'));
    });

    test("one student's look is never shown to another", async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        await A('PUT', { hairStyle: 'bun' }, a.token);
        assert.equal((await A('GET', undefined, b.token)).data.avatar, null);
    });

    test('a damaged saved row does not crash loading', async () => {
        const u = await h.registerUser();
        await h.db.query("INSERT INTO user_avatars (user_id, data) VALUES ($1, 'not json{')", [u.user.id]);
        const r = await A('GET', undefined, u.token);
        assert.deepEqual([r.status, r.data.avatar], [200, null]);
        assert.equal((await A('PUT', { hairStyle: 'short' }, u.token)).status, 200, 'and saving repairs it');
    });
});
