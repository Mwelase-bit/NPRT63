// Validation: social - friend codes and requests, class groups, shared study
// rooms, and invite-code resolution (the backend behind links and QR codes).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);

const api = (method, path, body, token) => h.req(method, `/api/social${path}`, body, token);
const iso = (daysAgo, hour = 12) => {
    const d = new Date(Date.now() - daysAgo * 86400000); d.setUTCHours(hour, 0, 0, 0); return d.toISOString();
};
const addSession = (userId, daysAgo, elapsed, completed = true) => h.db.query(
    'INSERT INTO focus_sessions (user_id, duration, elapsed, completed, coins_earned, created_at) VALUES ($1,$2,$3,$4,0,$5)',
    [userId, elapsed, elapsed, completed, iso(daysAgo)]);

// Make two students friends the quick way (request by code, accept)
async function befriend(a, b) {
    const code = (await api('GET', '/me', undefined, b.token)).data.code;
    await api('POST', '/friends/request', { code }, a.token);
    await api('POST', `/friends/${a.user.id}/accept`, {}, b.token);
}

describe('social - every endpoint needs a sign-in', () => {
    const calls = [
        ['GET', '/me'], ['GET', '/friends'], ['POST', '/friends/request'], ['GET', '/groups'], ['POST', '/groups'],
        ['POST', '/groups/join'], ['GET', '/rooms'], ['POST', '/rooms'], ['POST', '/rooms/join'], ['GET', '/invite/F-ABCD2345']
    ];
    for (const [m, p] of calls) {
        test(`${m} ${p} -> 401`, async () => assert.equal((await api(m, p, m === 'POST' ? {} : undefined)).status, 401));
    }
});

describe('friends - codes and requests', () => {
    test('every student gets one stable F- code', async () => {
        const u = await h.registerUser();
        const a = await api('GET', '/me', undefined, u.token);
        const b = await api('GET', '/me', undefined, u.token);
        assert.match(a.data.code, /^F-[A-HJ-NP-Z2-9]{8}$/);
        assert.equal(a.data.code, b.data.code);
    });

    test('two students never share a code', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        assert.notEqual((await api('GET', '/me', undefined, a.token)).data.code, (await api('GET', '/me', undefined, b.token)).data.code);
    });

    test('request -> pending for both sides -> accept -> friends', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const code = (await api('GET', '/me', undefined, b.token)).data.code;
        const r = await api('POST', '/friends/request', { code }, a.token);
        assert.equal(r.status, 201);
        assert.equal(r.data.status, 'pending');
        assert.equal((await api('GET', '/friends', undefined, a.token)).data.outgoing.length, 1);
        const inc = (await api('GET', '/friends', undefined, b.token)).data.incoming;
        assert.equal(inc.length, 1);
        assert.equal(inc[0].id, a.user.id);
        assert.equal((await api('POST', `/friends/${a.user.id}/accept`, {}, b.token)).status, 200);
        const fa = (await api('GET', '/friends', undefined, a.token)).data;
        const fb = (await api('GET', '/friends', undefined, b.token)).data;
        assert.deepEqual([fa.friends.map(f => f.id), fa.outgoing.length], [[b.user.id], 0]);
        assert.deepEqual([fb.friends.map(f => f.id), fb.incoming.length], [[a.user.id], 0]);
    });

    test('codes work in lower case, with spaces, and without the F- prefix', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const code = (await api('GET', '/me', undefined, b.token)).data.code;      // F-XXXXXXXX
        const sloppy = code.slice(2, 6).toLowerCase() + ' ' + code.slice(6).toLowerCase();
        assert.equal((await api('POST', '/friends/request', { code: sloppy }, a.token)).status, 201);
    });

    const bad = [
        ['an empty code', ''], ['a number', 12345678], ['too short', 'F-ABC'], ['letters that are not in codes (0, O, 1, I)', 'F-0O1IAAAA'],
        ['a group code', 'G-ABCD2345'], ['an object', { x: 1 }]
    ];
    for (const [label, code] of bad) {
        test(`rejects ${label}`, async () => {
            const u = await h.registerUser();
            assert.equal((await api('POST', '/friends/request', { code }, u.token)).status, 400);
        });
    }

    test('an unknown but well-formed code is 404', async () => {
        const u = await h.registerUser();
        assert.equal((await api('POST', '/friends/request', { code: 'F-ZZZZZZZZ' }, u.token)).status, 404);
    });

    test('you cannot befriend yourself', async () => {
        const u = await h.registerUser();
        const code = (await api('GET', '/me', undefined, u.token)).data.code;
        assert.equal((await api('POST', '/friends/request', { code }, u.token)).status, 400);
    });

    test('a second request is 409, and so is asking someone you are already friends with', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const code = (await api('GET', '/me', undefined, b.token)).data.code;
        await api('POST', '/friends/request', { code }, a.token);
        assert.equal((await api('POST', '/friends/request', { code }, a.token)).status, 409);
        await api('POST', `/friends/${a.user.id}/accept`, {}, b.token);
        assert.equal((await api('POST', '/friends/request', { code }, a.token)).status, 409);
    });

    test('asking someone who already asked you makes you friends at once', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const ca = (await api('GET', '/me', undefined, a.token)).data.code;
        const cb = (await api('GET', '/me', undefined, b.token)).data.code;
        await api('POST', '/friends/request', { code: cb }, a.token);
        const back = await api('POST', '/friends/request', { code: ca }, b.token);
        assert.equal(back.data.status, 'accepted');
        assert.equal((await api('GET', '/friends', undefined, a.token)).data.friends.length, 1);
    });

    test('only the person asked can accept or decline', async () => {
        const [a, b, c] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        await api('POST', '/friends/request', { code: (await api('GET', '/me', undefined, b.token)).data.code }, a.token);
        assert.equal((await api('POST', `/friends/${b.user.id}/accept`, {}, a.token)).status, 404, 'the sender cannot accept their own request');
        assert.equal((await api('POST', `/friends/${a.user.id}/accept`, {}, c.token)).status, 404, 'a stranger cannot accept it');
        assert.equal((await api('POST', `/friends/${a.user.id}/decline`, {}, c.token)).status, 404);
        assert.equal((await api('POST', `/friends/${a.user.id}/decline`, {}, b.token)).status, 200);
        assert.equal((await api('GET', '/friends', undefined, a.token)).data.outgoing.length, 0);
    });

    test('accept/decline reject garbage ids', async () => {
        const u = await h.registerUser();
        for (const id of ['abc', '-1', '1.5', '99999999999']) assert.equal((await api('POST', `/friends/${id}/accept`, {}, u.token)).status, 400, id);
    });

    test('unfriend removes the link for both; cancelling a sent request works too', async () => {
        const [a, b, c] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        await befriend(a, b);
        assert.equal((await api('DELETE', `/friends/${b.user.id}`, undefined, a.token)).status, 200);
        assert.equal((await api('GET', '/friends', undefined, b.token)).data.friends.length, 0);
        await api('POST', '/friends/request', { code: (await api('GET', '/me', undefined, c.token)).data.code }, a.token);
        assert.equal((await api('DELETE', `/friends/${c.user.id}`, undefined, a.token)).status, 200);
        assert.equal((await api('GET', '/friends', undefined, c.token)).data.incoming.length, 0);
        assert.equal((await api('DELETE', `/friends/${c.user.id}`, undefined, a.token)).status, 404);
    });

    test('friends are ranked by focus time this week, and never expose email', async () => {
        const [me, f1, f2] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        await befriend(me, f1); await befriend(me, f2);
        await addSession(f1.user.id, 1, 1800);
        await addSession(f2.user.id, 2, 5400);
        await addSession(f2.user.id, 30, 99999);                 // too old to count
        await addSession(f1.user.id, 1, 3000, false);            // interrupted: not counted
        const list = (await api('GET', '/friends', undefined, me.token)).data.friends;
        assert.deepEqual(list.map(f => [f.id, f.weeklySeconds]), [[f2.user.id, 5400], [f1.user.id, 1800]]);
        assert.ok(!JSON.stringify(list).includes('@'), 'no email addresses in the friends list');
    });
});

describe('groups', () => {
    test('create -> I own it, with a G- invite code', async () => {
        const u = await h.registerUser();
        const r = await api('POST', '/groups', { name: '  NPRT630   Class  ' }, u.token);
        assert.equal(r.status, 201);
        assert.equal(r.data.group.name, 'NPRT630 Class', 'whitespace is tidied');
        assert.equal(r.data.group.role, 'owner');
        assert.equal(r.data.group.memberCount, 1);
        assert.match(r.data.group.inviteCode, /^G-[A-HJ-NP-Z2-9]{8}$/);
        assert.equal((await api('GET', '/groups', undefined, u.token)).data.groups.length, 1);
    });

    for (const [label, name] of [['missing', undefined], ['one letter', 'A'], ['41 characters', 'x'.repeat(41)], ['a number', 42], ['blank', '   ']]) {
        test(`rejects a ${label} group name`, async () => {
            const u = await h.registerUser();
            assert.equal((await api('POST', '/groups', { name }, u.token)).status, 400);
        });
    }

    test('joining by code works once, is idempotent, and accepts sloppy input', async () => {
        const [owner, s] = [await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Maths 101' }, owner.token)).data.group;
        const j = await api('POST', '/groups/join', { code: g.inviteCode.toLowerCase().replace('-', ' ') }, s.token);
        assert.equal(j.status, 201);
        assert.equal(j.data.group.memberCount, 2);
        assert.equal(j.data.group.role, 'member');
        const again = await api('POST', '/groups/join', { code: g.inviteCode }, s.token);
        assert.equal(again.status, 200);
        assert.equal(again.data.alreadyMember, true);
        assert.equal((await api('GET', '/groups', undefined, owner.token)).data.groups[0].memberCount, 2);
    });

    test('bad and unknown codes are rejected clearly', async () => {
        const u = await h.registerUser();
        assert.equal((await api('POST', '/groups/join', { code: 'nope' }, u.token)).status, 400);
        assert.equal((await api('POST', '/groups/join', { code: 'F-ABCD2345' }, u.token)).status, 400, 'a friend code is not a group code');
        assert.equal((await api('POST', '/groups/join', { code: 'G-ZZZZZZZZ' }, u.token)).status, 404);
    });

    test('members see a weekly leaderboard; outsiders get 404 (not 403)', async () => {
        const [owner, s, outsider] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Study crew' }, owner.token)).data.group;
        await api('POST', '/groups/join', { code: g.inviteCode }, s.token);
        await addSession(owner.user.id, 1, 1200);
        await addSession(s.user.id, 2, 4800);
        const r = await api('GET', `/groups/${g.id}`, undefined, owner.token);
        assert.equal(r.status, 200);
        assert.deepEqual(r.data.members.map(m => [m.id, m.weeklySeconds, m.rank]), [[s.user.id, 4800, 1], [owner.user.id, 1200, 2]]);
        assert.equal(r.data.totalWeeklySeconds, 6000);
        assert.equal(r.data.members.find(m => m.isMe).id, owner.user.id);
        assert.ok(!JSON.stringify(r.data).includes('@'));
        assert.equal((await api('GET', `/groups/${g.id}`, undefined, outsider.token)).status, 404);
        assert.equal((await api('GET', '/groups/99999', undefined, owner.token)).status, 404);
        assert.equal((await api('GET', '/groups/abc', undefined, owner.token)).status, 404);
    });

    test('the owner leaving hands the group to the longest-standing member', async () => {
        const [owner, s1, s2] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Handover' }, owner.token)).data.group;
        await api('POST', '/groups/join', { code: g.inviteCode }, s1.token);
        await api('POST', '/groups/join', { code: g.inviteCode }, s2.token);
        const left = await api('POST', `/groups/${g.id}/leave`, {}, owner.token);
        assert.deepEqual([left.status, left.data.groupDeleted], [200, false]);
        assert.equal((await api('GET', `/groups/${g.id}`, undefined, s1.token)).data.group.role, 'owner');
        assert.equal((await api('GET', `/groups/${g.id}`, undefined, owner.token)).status, 404, 'a former member loses access');
    });

    test('the last member leaving deletes the group and its code stops working', async () => {
        const [owner, s] = [await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Solo' }, owner.token)).data.group;
        const left = await api('POST', `/groups/${g.id}/leave`, {}, owner.token);
        assert.equal(left.data.groupDeleted, true);
        assert.equal((await api('POST', '/groups/join', { code: g.inviteCode }, s.token)).status, 404);
    });

    test('only the owner can reset the code, and the old code dies', async () => {
        const [owner, s] = [await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Reset me' }, owner.token)).data.group;
        await api('POST', '/groups/join', { code: g.inviteCode }, s.token);
        assert.equal((await api('POST', `/groups/${g.id}/regenerate-code`, {}, s.token)).status, 403);
        const r = await api('POST', `/groups/${g.id}/regenerate-code`, {}, owner.token);
        assert.notEqual(r.data.inviteCode, g.inviteCode);
        const late = await h.registerUser();
        assert.equal((await api('POST', '/groups/join', { code: g.inviteCode }, late.token)).status, 404, 'old code is dead');
        assert.equal((await api('POST', '/groups/join', { code: r.data.inviteCode }, late.token)).status, 201);
    });

    test('only the owner can remove members or delete the group', async () => {
        const [owner, s, t] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Rules' }, owner.token)).data.group;
        await api('POST', '/groups/join', { code: g.inviteCode }, s.token);
        await api('POST', '/groups/join', { code: g.inviteCode }, t.token);
        assert.equal((await api('DELETE', `/groups/${g.id}/members/${t.user.id}`, undefined, s.token)).status, 403);
        assert.equal((await api('DELETE', `/groups/${g.id}/members/${owner.user.id}`, undefined, owner.token)).status, 400, 'cannot remove yourself');
        assert.equal((await api('DELETE', `/groups/${g.id}/members/${t.user.id}`, undefined, owner.token)).status, 200);
        assert.equal((await api('DELETE', `/groups/${g.id}/members/${t.user.id}`, undefined, owner.token)).status, 404);
        assert.equal((await api('DELETE', `/groups/${g.id}`, undefined, s.token)).status, 403);
        assert.equal((await api('DELETE', `/groups/${g.id}`, undefined, owner.token)).status, 200);
        assert.equal((await api('GET', '/groups', undefined, s.token)).data.groups.length, 0);
    });
});

describe('study rooms', () => {
    test('create -> host is in it, R- code, default title, 12 h lifetime', async () => {
        const u = await h.registerUser({ name: 'Thandi' });
        const r = await api('POST', '/rooms', { durationMin: 45 }, u.token);
        assert.equal(r.status, 201);
        assert.match(r.data.room.inviteCode, /^R-[A-HJ-NP-Z2-9]{8}$/);
        assert.equal(r.data.room.title, "Thandi's study session");
        assert.equal(r.data.room.durationMin, 45);
        assert.equal(r.data.room.memberCount, 1);
        assert.equal(r.data.room.myStatus, 'joined');
        const hours = (Date.parse(r.data.room.expiresAt) - Date.now()) / 3600000;
        assert.ok(hours > 11.9 && hours <= 12.01, `expires in ${hours.toFixed(2)} h`);
    });

    for (const [label, body] of [
        ['4 minutes', { durationMin: 4 }], ['721 minutes', { durationMin: 721 }], ['a fraction', { durationMin: 25.5 }],
        ['a string', { durationMin: '45' }], ['nothing', {}], ['a 1-letter title', { durationMin: 30, title: 'x' }],
        ['a 61-letter title', { durationMin: 30, title: 'x'.repeat(61) }]
    ]) {
        test(`rejects ${label}`, async () => {
            const u = await h.registerUser();
            assert.equal((await api('POST', '/rooms', body, u.token)).status, 400);
        });
    }

    test('a room can only be linked to a group you belong to', async () => {
        const [a, b] = [await h.registerUser(), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Private' }, a.token)).data.group;
        assert.equal((await api('POST', '/rooms', { durationMin: 30, groupId: g.id }, b.token)).status, 403);
        const ok = await api('POST', '/rooms', { durationMin: 30, groupId: g.id, title: 'Exam prep' }, a.token);
        assert.equal(ok.status, 201);
        assert.equal(ok.data.room.groupName, 'Private');
    });

    test('joining by code: 201 then 200, and the member count follows', async () => {
        const [host, s] = [await h.registerUser(), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 25 }, host.token)).data.room;
        const j = await api('POST', '/rooms/join', { code: room.inviteCode.toLowerCase() }, s.token);
        assert.equal(j.status, 201);
        assert.equal(j.data.room.memberCount, 2);
        const again = await api('POST', '/rooms/join', { code: room.inviteCode }, s.token);
        assert.deepEqual([again.status, again.data.alreadyMember], [200, true]);
        assert.equal((await api('POST', '/rooms/join', { code: 'R-ZZZZZZZZ' }, s.token)).status, 404);
        assert.equal((await api('POST', '/rooms/join', { code: 'G-ABCD2345' }, s.token)).status, 400);
    });

    test('everyone in a room sees everyone else and their live status', async () => {
        const [host, s] = [await h.registerUser({ name: 'Host H' }), await h.registerUser({ name: 'Sam S' })];
        const room = (await api('POST', '/rooms', { durationMin: 25 }, host.token)).data.room;
        await api('POST', '/rooms/join', { code: room.inviteCode }, s.token);
        await api('POST', `/rooms/${room.id}/status`, { status: 'focusing' }, s.token);
        const view = (await api('GET', `/rooms/${room.id}`, undefined, host.token)).data;
        assert.deepEqual(view.members.map(m => [m.name, m.status, m.isHost]), [['Host H', 'joined', true], ['Sam S', 'focusing', false]]);
        assert.deepEqual(view.summary, { joined: 1, focusing: 1, completed: 0, interrupted: 0 });
        assert.equal(view.members.find(m => m.isMe).name, 'Host H');
    });

    test('non-members cannot read a room', async () => {
        const [host, out] = [await h.registerUser(), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 25 }, host.token)).data.room;
        assert.equal((await api('GET', `/rooms/${room.id}`, undefined, out.token)).status, 404);
        assert.equal((await api('POST', `/rooms/${room.id}/status`, { status: 'focusing' }, out.token)).status, 404);
    });

    test('status moves follow joined -> focusing -> completed/interrupted, and can reset', async () => {
        const [host, s] = [await h.registerUser(), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 25 }, host.token)).data.room;
        await api('POST', '/rooms/join', { code: room.inviteCode }, s.token);
        const set = (status) => api('POST', `/rooms/${room.id}/status`, { status }, s.token);
        assert.equal((await set('completed')).status, 409, 'cannot complete without focusing first');
        assert.equal((await set('focusing')).status, 200);
        assert.equal((await set('focusing')).status, 200, 'repeating the same status is harmless');
        assert.equal((await set('interrupted')).status, 200);
        assert.equal((await set('completed')).status, 409);
        assert.equal((await set('joined')).status, 200, 'ready to go again');
        assert.equal((await set('focusing')).status, 200);
        assert.equal((await set('completed')).status, 200);
        assert.equal((await set('banana')).status, 400);
        assert.equal((await api('POST', `/rooms/${room.id}/status`, {}, s.token)).status, 400);
    });

    test('joining by id: friends and group mates yes, strangers no', async () => {
        const [host, friend, mate, stranger] = [await h.registerUser(), await h.registerUser(), await h.registerUser(), await h.registerUser()];
        await befriend(friend, host);
        const g = (await api('POST', '/groups', { name: 'Mates' }, host.token)).data.group;
        await api('POST', '/groups/join', { code: g.inviteCode }, mate.token);
        const plain = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        const grouped = (await api('POST', '/rooms', { durationMin: 30, groupId: g.id }, host.token)).data.room;
        assert.equal((await api('POST', `/rooms/${plain.id}/join`, {}, friend.token)).status, 201);
        assert.equal((await api('POST', `/rooms/${plain.id}/join`, {}, stranger.token)).status, 403);
        assert.equal((await api('POST', `/rooms/${plain.id}/join`, {}, mate.token)).status, 403, 'a group mate is not a friend; only the grouped room is open to them');
        assert.equal((await api('POST', `/rooms/${grouped.id}/join`, {}, mate.token)).status, 201);
        assert.equal((await api('POST', '/rooms/99999/join', {}, friend.token)).status, 404);
    });

    test('the room list shows mine plus open rooms from friends and groups', async () => {
        const [host, friend, mate] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        await befriend(friend, host);
        const g = (await api('POST', '/groups', { name: 'List test' }, host.token)).data.group;
        await api('POST', '/groups/join', { code: g.inviteCode }, mate.token);
        const r1 = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        const r2 = (await api('POST', '/rooms', { durationMin: 60, groupId: g.id }, host.token)).data.room;
        const hostView = (await api('GET', '/rooms', undefined, host.token)).data;
        assert.deepEqual(hostView.rooms.map(r => r.id).sort(), [r1.id, r2.id].sort());
        assert.equal(hostView.rooms.every(r => r.isHost), true);
        const friendView = (await api('GET', '/rooms', undefined, friend.token)).data;
        assert.deepEqual(friendView.joinable.map(r => [r.id, r.via]).sort(), [[r1.id, 'friend'], [r2.id, 'friend']].sort());
        const mateView = (await api('GET', '/rooms', undefined, mate.token)).data;
        assert.deepEqual(mateView.joinable.map(r => [r.id, r.via]), [[r2.id, 'group']]);
        await api('POST', `/rooms/${r1.id}/join`, {}, friend.token);
        const after = (await api('GET', '/rooms', undefined, friend.token)).data;
        assert.deepEqual([after.rooms.map(r => r.id), after.joinable.map(r => r.id)], [[r1.id], [r2.id]], 'joined rooms move from joinable to mine');
    });

    test('the host leaving, or closing, ends the room for everyone', async () => {
        const [host, s, late] = [await h.registerUser(), await h.registerUser(), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        await api('POST', '/rooms/join', { code: room.inviteCode }, s.token);
        assert.equal((await api('POST', `/rooms/${room.id}/close`, {}, s.token)).status, 403, 'only the host can close');
        assert.equal((await api('POST', `/rooms/${room.id}/close`, {}, host.token)).status, 200);
        assert.equal((await api('POST', '/rooms/join', { code: room.inviteCode }, late.token)).status, 410);
        assert.equal((await api('GET', '/rooms', undefined, s.token)).data.rooms.length, 0, 'closed rooms drop out of the list');

        const r2 = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        await api('POST', '/rooms/join', { code: r2.inviteCode }, s.token);
        const leave = await api('POST', `/rooms/${r2.id}/leave`, {}, host.token);
        assert.equal(leave.data.roomClosed, true);
        assert.equal((await api('POST', '/rooms/join', { code: r2.inviteCode }, late.token)).status, 410);
    });

    test('a member leaving does not end the room', async () => {
        const [host, s] = [await h.registerUser(), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        await api('POST', '/rooms/join', { code: room.inviteCode }, s.token);
        const r = await api('POST', `/rooms/${room.id}/leave`, {}, s.token);
        assert.deepEqual([r.status, r.data.roomClosed], [200, false]);
        assert.equal((await api('GET', `/rooms/${room.id}`, undefined, host.token)).data.room.memberCount, 1);
    });

    test('an expired room cannot be joined', async () => {
        const [host, s] = [await h.registerUser(), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        await h.db.query('UPDATE study_rooms SET expires_at = $1 WHERE id = $2', [new Date(Date.now() - 60000).toISOString(), room.id]);
        assert.equal((await api('POST', '/rooms/join', { code: room.inviteCode }, s.token)).status, 410);
        assert.equal((await api('GET', '/rooms', undefined, host.token)).data.rooms.length, 0);
    });

    test('a room holds at most 30 students', async () => {
        const host = await h.registerUser();
        const room = (await api('POST', '/rooms', { durationMin: 30 }, host.token)).data.room;
        const rid = room.id;
        // 29 more members straight into the table (the host is the 1st)
        for (let i = 0; i < 29; i++) {
            const r = await h.db.query(
                "INSERT INTO users (name, email, password, faculty) VALUES ($1, $2, 'x', 'nas') RETURNING id",
                [`Filler ${i}`, `filler${i}_${Date.now()}@spu.ac.za`]);
            await h.db.query("INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)", [rid, r.rows[0].id]);
        }
        const extra = await h.registerUser();
        assert.equal((await api('POST', '/rooms/join', { code: room.inviteCode }, extra.token)).status, 409);
    });
});

describe('invite preview (what a link or QR scan resolves to)', () => {
    test('a friend code shows who it is and our relationship', async () => {
        const [a, b] = [await h.registerUser({ name: 'Ayanda' }), await h.registerUser()];
        const code = (await api('GET', '/me', undefined, a.token)).data.code;
        let r = await api('GET', `/invite/${code}`, undefined, b.token);
        assert.deepEqual([r.data.kind, r.data.name, r.data.relation, r.data.isMe], ['friend', 'Ayanda', 'none', false]);
        await api('POST', '/friends/request', { code }, b.token);
        assert.equal((await api('GET', `/invite/${code}`, undefined, b.token)).data.relation, 'requested');
        assert.equal((await api('GET', `/invite/${code}`, undefined, a.token)).data.isMe, true);
        await api('POST', `/friends/${b.user.id}/accept`, {}, a.token);
        assert.equal((await api('GET', `/invite/${code}`, undefined, b.token)).data.relation, 'friends');
    });

    test('a group code shows the group and whether I am already in', async () => {
        const [owner, s] = [await h.registerUser({ name: 'Owner O' }), await h.registerUser()];
        const g = (await api('POST', '/groups', { name: 'Law Year 2' }, owner.token)).data.group;
        const before = (await api('GET', `/invite/${g.inviteCode}`, undefined, s.token)).data;
        assert.deepEqual([before.kind, before.name, before.ownerName, before.memberCount, before.alreadyMember], ['group', 'Law Year 2', 'Owner O', 1, false]);
        await api('POST', '/groups/join', { code: g.inviteCode }, s.token);
        assert.equal((await api('GET', `/invite/${g.inviteCode}`, undefined, s.token)).data.alreadyMember, true);
    });

    test('a room code shows the room; a code with no prefix is found too', async () => {
        const [host, s] = [await h.registerUser({ name: 'Hosty' }), await h.registerUser()];
        const room = (await api('POST', '/rooms', { durationMin: 90, title: 'Finals cram' }, host.token)).data.room;
        const r = (await api('GET', `/invite/${room.inviteCode}`, undefined, s.token)).data;
        assert.deepEqual([r.kind, r.title, r.hostName, r.durationMin, r.live], ['room', 'Finals cram', 'Hosty', 90, true]);
        const bare = (await api('GET', `/invite/${room.inviteCode.slice(2)}`, undefined, s.token)).data;
        assert.equal(bare.kind, 'room');
    });

    test('garbage is 400 and an unknown code is 404', async () => {
        const u = await h.registerUser();
        assert.equal((await api('GET', '/invite/hello', undefined, u.token)).status, 400);
        assert.equal((await api('GET', '/invite/F-ZZZZZZZZ', undefined, u.token)).status, 404);
    });
});
