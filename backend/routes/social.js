// routes/social.js - friends, class groups and shared study rooms.
//
// Everything is joined with a short invite code. The client turns a code into a
// link (/?invite=CODE) and a QR code, so a friend, a class or a study room can
// be shared in one tap or one scan. Code prefixes tell the kinds apart:
//   F-XXXXXXXX friend code    G-XXXXXXXX class group    R-XXXXXXXX study room
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { pool } = require('../database');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');
const { parseId, isIntInRange } = require('../middleware/validate');
const { notifyUser, notifyMany, friendIdsOf, nameOf } = require('../utils/notify');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I to avoid misreading
const CODE_LENGTH = 8;
const MAX_GROUPS_PER_USER = 20;
const MAX_GROUP_MEMBERS = 100;
const MAX_ROOM_MEMBERS = 30;
const ROOM_LIFETIME_MS = 12 * 3600 * 1000;
const ROOM_STATUSES = ['joined', 'focusing', 'completed', 'interrupted'];
// Allowed status moves for a room member (anyone can always go back to 'joined' to run it again)
const ROOM_MOVES = { joined: ['focusing'], focusing: ['completed', 'interrupted', 'joined'], completed: ['joined'], interrupted: ['joined'] };

router.use(authenticate);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeCode = (prefix) => {
    let body = '';
    for (let i = 0; i < CODE_LENGTH; i++) body += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    return `${prefix}-${body}`;
};

// "g-abcd 2345", "abcd2345", "G-ABCD2345" -> { prefix: 'G' | null, canonical: 'G-ABCD2345' | null, body }
const normaliseCode = (raw) => {
    if (typeof raw !== 'string') return null;
    let c = raw.toUpperCase().replace(/[\s_]/g, '');
    let prefix = null;
    const m = c.match(/^([FGR])-?(.+)$/);
    if (m && m[2].length === CODE_LENGTH) { prefix = m[1]; c = m[2]; }
    c = c.replace(/-/g, '');
    if (c.length !== CODE_LENGTH || ![...c].every(ch => CODE_ALPHABET.includes(ch))) return null;
    return { prefix, body: c, canonical: prefix ? `${prefix}-${c}` : null };
};

const toDate = (v) => {
    if (v instanceof Date) return v;
    const s = String(v);
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
};

// Insert a row that carries a fresh unique code, retrying on the rare collision
async function insertWithCode(prefix, run) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const code = makeCode(prefix);
        try { return await run(code); }
        catch (err) { if (err.code !== '23505') throw err; }
    }
    throw new AppError('Could not create a unique invite code. Please try again.', 500);
}

async function ensureUserCode(userId) {
    const found = await pool.query('SELECT code FROM user_codes WHERE user_id = $1', [userId]);
    if (found.rows[0]) return found.rows[0].code;
    try {
        return await insertWithCode('F', async (code) => {
            await pool.query('INSERT INTO user_codes (user_id, code) VALUES ($1, $2)', [userId, code]);
            return code;
        });
    } catch (err) {
        // A parallel request may have created it first
        const again = await pool.query('SELECT code FROM user_codes WHERE user_id = $1', [userId]);
        if (again.rows[0]) return again.rows[0].code;
        throw err;
    }
}

const placeholders = (n, start = 1) => Array.from({ length: n }, (_, i) => `$${i + start}`).join(', ');

// Completed focus seconds in the last 7 days for a set of users
async function weeklySeconds(userIds) {
    const out = new Map(userIds.map(id => [id, 0]));
    if (!userIds.length) return out;
    const r = await pool.query(`
        SELECT user_id, COALESCE(SUM(elapsed), 0) AS sec
        FROM focus_sessions
        WHERE completed = TRUE
          AND created_at::date >= (CURRENT_DATE - INTERVAL '7 days')
          AND user_id IN (${placeholders(userIds.length)})
        GROUP BY user_id
    `, userIds);
    r.rows.forEach(row => out.set(row.user_id, parseInt(row.sec, 10)));
    return out;
}

const publicUser = (u, weekly) => ({
    id: u.id, name: u.name, faculty: u.faculty, streak: u.streak,
    totalFocusSec: u.total_focus_sec, weeklySeconds: weekly || 0
});

async function usersByIds(ids) {
    if (!ids.length) return [];
    const r = await pool.query(
        `SELECT id, name, faculty, streak, total_focus_sec FROM users WHERE id IN (${placeholders(ids.length)})`, ids);
    return r.rows;
}

async function relationBetween(a, b) {
    const r = await pool.query(`
        SELECT id, requester_id, addressee_id, status FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)
    `, [a, b]);
    return r.rows[0] || null;
}

const areFriends = async (a, b) => {
    const rel = await relationBetween(a, b);
    return !!rel && rel.status === 'accepted';
};

const cleanName = (v, min, max, label) => {
    if (typeof v !== 'string') throw new AppError(`${label} is required.`, 400);
    const name = v.replace(/\s+/g, ' ').trim();
    if (name.length < min || name.length > max) throw new AppError(`${label} must be ${min} to ${max} characters.`, 400);
    return name;
};

// ─── Me: my friend code ───────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
    const u = await pool.query('SELECT id, name, faculty FROM users WHERE id = $1', [req.user.id]);
    res.json({ id: req.user.id, name: u.rows[0].name, faculty: u.rows[0].faculty, code: await ensureUserCode(req.user.id) });
});

// ─── Friends ──────────────────────────────────────────────────────────────────
router.get('/friends', async (req, res) => {
    const me = req.user.id;
    const r = await pool.query(`
        SELECT f.requester_id, f.addressee_id, f.status, f.created_at,
               u.id AS uid, u.name, u.faculty, u.streak, u.total_focus_sec
        FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
        WHERE f.requester_id = $1 OR f.addressee_id = $1
        ORDER BY f.created_at DESC
    `, [me]);
    const accepted = r.rows.filter(x => x.status === 'accepted');
    const weekly = await weeklySeconds(accepted.map(x => x.uid));
    const row = (x) => ({ id: x.uid, name: x.name, faculty: x.faculty, streak: x.streak, totalFocusSec: x.total_focus_sec, since: x.created_at });
    res.json({
        friends: accepted.map(x => ({ ...row(x), weeklySeconds: weekly.get(x.uid) || 0 }))
            .sort((a, b) => b.weeklySeconds - a.weeklySeconds || a.name.localeCompare(b.name)),
        incoming: r.rows.filter(x => x.status === 'pending' && x.addressee_id === me).map(row),
        outgoing: r.rows.filter(x => x.status === 'pending' && x.requester_id === me).map(row)
    });
});

router.post('/friends/request', async (req, res) => {
    const me = req.user.id;
    const parsed = normaliseCode(req.body.code);
    if (!parsed || (parsed.prefix && parsed.prefix !== 'F')) throw new AppError('That does not look like a friend code.', 400);
    const target = await pool.query('SELECT user_id FROM user_codes WHERE code = $1', [`F-${parsed.body}`]);
    if (!target.rows[0]) throw new AppError('No student has that friend code.', 404);
    const them = target.rows[0].user_id;
    if (them === me) throw new AppError('That is your own friend code.', 400);

    const rel = await relationBetween(me, them);
    if (rel) {
        if (rel.status === 'accepted') throw new AppError('You are already friends.', 409);
        if (rel.requester_id === me) throw new AppError('You already sent this student a request.', 409);
        // They already asked you: asking back means yes
        await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [rel.id]);
        const myName = await nameOf(me);
        await notifyUser(them, { category: 'friends', kind: 'friend_accepted', title: `${myName} is now your friend`, body: 'You can study together.', link: 'community:friends' });
        return res.json({ status: 'accepted', message: 'You are now friends.' });
    }
    await pool.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [me, them]);
    const requesterName = await nameOf(me);
    await notifyUser(them, { category: 'friends', kind: 'friend_request', title: `${requesterName} sent you a friend request`, body: 'Open Community to accept it.', link: 'community:friends' });
    res.status(201).json({ status: 'pending', message: 'Friend request sent.' });
});

router.post('/friends/:id/accept', async (req, res) => {
    const other = parseId(req.params.id);
    if (!other) throw new AppError('Invalid user.', 400);
    const rel = await relationBetween(req.user.id, other);
    if (!rel || rel.status !== 'pending' || rel.addressee_id !== req.user.id) throw new AppError('No pending request from that student.', 404);
    await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [rel.id]);
    await notifyUser(other, { category: 'friends', kind: 'friend_accepted', title: `${await nameOf(req.user.id)} accepted your friend request`, body: 'You can study together now.', link: 'community:friends' });
    res.json({ status: 'accepted' });
});

router.post('/friends/:id/decline', async (req, res) => {
    const other = parseId(req.params.id);
    if (!other) throw new AppError('Invalid user.', 400);
    const rel = await relationBetween(req.user.id, other);
    if (!rel || rel.status !== 'pending' || rel.addressee_id !== req.user.id) throw new AppError('No pending request from that student.', 404);
    await pool.query('DELETE FROM friendships WHERE id = $1', [rel.id]);
    res.json({ status: 'declined' });
});

// Unfriend, or cancel a request you sent
router.delete('/friends/:id', async (req, res) => {
    const other = parseId(req.params.id);
    if (!other) throw new AppError('Invalid user.', 400);
    const rel = await relationBetween(req.user.id, other);
    if (!rel) throw new AppError('You are not connected to that student.', 404);
    await pool.query('DELETE FROM friendships WHERE id = $1', [rel.id]);
    res.json({ status: 'removed' });
});

// ─── Class groups ─────────────────────────────────────────────────────────────
const groupRow = (g) => ({
    id: g.id, name: g.name, inviteCode: g.invite_code, ownerId: g.owner_id,
    role: g.role, memberCount: parseInt(g.member_count, 10), createdAt: g.created_at
});

async function myGroup(groupId, userId) {
    const r = await pool.query(`
        SELECT g.id, g.name, g.invite_code, g.owner_id, g.created_at, gm.role,
               (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
        FROM study_groups g JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2
        WHERE g.id = $1
    `, [groupId, userId]);
    return r.rows[0] || null;
}

router.post('/groups', async (req, res) => {
    const name = cleanName(req.body.name, 2, 40, 'Group name');
    const count = await pool.query('SELECT COUNT(*) AS n FROM group_members WHERE user_id = $1', [req.user.id]);
    if (parseInt(count.rows[0].n, 10) >= MAX_GROUPS_PER_USER) throw new AppError(`You can be in at most ${MAX_GROUPS_PER_USER} groups.`, 400);
    const group = await insertWithCode('G', async (code) => {
        const r = await pool.query('INSERT INTO study_groups (name, owner_id, invite_code) VALUES ($1, $2, $3) RETURNING id', [name, req.user.id, code]);
        return r.rows[0].id;
    });
    await pool.query("INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')", [group, req.user.id]);
    res.status(201).json({ group: groupRow(await myGroup(group, req.user.id)) });
});

router.get('/groups', async (req, res) => {
    const r = await pool.query(`
        SELECT g.id, g.name, g.invite_code, g.owner_id, g.created_at, gm.role,
               (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
        FROM group_members gm JOIN study_groups g ON g.id = gm.group_id
        WHERE gm.user_id = $1 ORDER BY g.created_at DESC
    `, [req.user.id]);
    res.json({ groups: r.rows.map(groupRow) });
});

router.get('/groups/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const g = id && await myGroup(id, req.user.id);
    if (!g) throw new AppError('Group not found.', 404);     // same answer for "missing" and "not yours"
    const m = await pool.query('SELECT user_id, role, joined_at FROM group_members WHERE group_id = $1', [id]);
    const ids = m.rows.map(x => x.user_id);
    const [users, weekly] = await Promise.all([usersByIds(ids), weeklySeconds(ids)]);
    const byId = new Map(users.map(u => [u.id, u]));
    const members = m.rows.map(x => ({ ...publicUser(byId.get(x.user_id), weekly.get(x.user_id)), role: x.role, joinedAt: x.joined_at, isMe: x.user_id === req.user.id }))
        .sort((a, b) => b.weeklySeconds - a.weeklySeconds || a.name.localeCompare(b.name));
    members.forEach((x, i) => { x.rank = i + 1; });
    res.json({ group: groupRow(g), members, totalWeeklySeconds: members.reduce((n, x) => n + x.weeklySeconds, 0) });
});

router.post('/groups/join', async (req, res) => {
    const parsed = normaliseCode(req.body.code);
    if (!parsed || (parsed.prefix && parsed.prefix !== 'G')) throw new AppError('That does not look like a group invite code.', 400);
    const g = await pool.query('SELECT id FROM study_groups WHERE invite_code = $1', [`G-${parsed.body}`]);
    if (!g.rows[0]) throw new AppError('No group has that invite code. It may have been reset.', 404);
    const id = g.rows[0].id;
    const existing = await myGroup(id, req.user.id);
    if (existing) return res.json({ group: groupRow(existing), alreadyMember: true });
    const n = await pool.query('SELECT COUNT(*) AS n FROM group_members WHERE group_id = $1', [id]);
    if (parseInt(n.rows[0].n, 10) >= MAX_GROUP_MEMBERS) throw new AppError('This group is full.', 409);
    const mine = await pool.query('SELECT COUNT(*) AS n FROM group_members WHERE user_id = $1', [req.user.id]);
    if (parseInt(mine.rows[0].n, 10) >= MAX_GROUPS_PER_USER) throw new AppError(`You can be in at most ${MAX_GROUPS_PER_USER} groups.`, 400);
    await pool.query("INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')", [id, req.user.id]);
    const joined = groupRow(await myGroup(id, req.user.id));
    const ownerRow = await pool.query('SELECT owner_id FROM study_groups WHERE id = $1', [id]);
    if (ownerRow.rows[0]) {
        await notifyUser(ownerRow.rows[0].owner_id, { category: 'groups', kind: 'group_joined', title: `${await nameOf(req.user.id)} joined ${joined.name}`, body: `${joined.memberCount} members now.`, link: 'community:groups' });
    }
    res.status(201).json({ group: joined, alreadyMember: false });
});

router.post('/groups/:id/leave', async (req, res) => {
    const id = parseId(req.params.id);
    const g = id && await myGroup(id, req.user.id);
    if (!g) throw new AppError('Group not found.', 404);
    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
    const rest = await pool.query('SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY joined_at ASC, user_id ASC', [id]);
    if (!rest.rows.length) {
        await pool.query('DELETE FROM study_groups WHERE id = $1', [id]);
        return res.json({ status: 'left', groupDeleted: true });
    }
    if (g.owner_id === req.user.id) {            // hand the group to the longest-standing member
        const next = rest.rows[0].user_id;
        await pool.query('UPDATE study_groups SET owner_id = $1 WHERE id = $2', [next, id]);
        await pool.query("UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2", [id, next]);
    }
    res.json({ status: 'left', groupDeleted: false });
});

router.post('/groups/:id/regenerate-code', async (req, res) => {
    const id = parseId(req.params.id);
    const g = id && await myGroup(id, req.user.id);
    if (!g) throw new AppError('Group not found.', 404);
    if (g.owner_id !== req.user.id) throw new AppError('Only the group owner can reset the invite code.', 403);
    const code = await insertWithCode('G', async (c) => {
        await pool.query('UPDATE study_groups SET invite_code = $1 WHERE id = $2', [c, id]);
        return c;
    });
    res.json({ inviteCode: code });
});

router.delete('/groups/:id/members/:userId', async (req, res) => {
    const id = parseId(req.params.id), uid = parseId(req.params.userId);
    const g = id && await myGroup(id, req.user.id);
    if (!g) throw new AppError('Group not found.', 404);
    if (g.owner_id !== req.user.id) throw new AppError('Only the group owner can remove members.', 403);
    if (!uid || uid === req.user.id) throw new AppError('Choose another member to remove.', 400);
    const del = await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, uid]);
    if (!del.rowCount) throw new AppError('That student is not in this group.', 404);
    res.json({ status: 'removed' });
});

router.delete('/groups/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const g = id && await myGroup(id, req.user.id);
    if (!g) throw new AppError('Group not found.', 404);
    if (g.owner_id !== req.user.id) throw new AppError('Only the group owner can delete the group.', 403);
    await pool.query('DELETE FROM study_groups WHERE id = $1', [id]);
    res.json({ status: 'deleted' });
});

// ─── Shared study rooms ───────────────────────────────────────────────────────
const isLive = (room) => room.status === 'open' && toDate(room.expires_at).getTime() > Date.now();

const roomRow = (r, extra) => ({
    id: r.id, title: r.title, durationMin: r.duration_min, hostId: r.host_id, hostName: r.host_name,
    groupId: r.group_id, groupName: r.group_name || null, inviteCode: r.invite_code,
    status: isLive(r) ? 'open' : 'closed', createdAt: r.created_at, expiresAt: r.expires_at,
    memberCount: parseInt(r.member_count, 10), ...extra
});

const ROOM_SELECT = `
    SELECT r.id, r.host_id, r.group_id, r.title, r.duration_min, r.invite_code, r.status, r.created_at, r.expires_at,
           h.name AS host_name, g.name AS group_name,
           (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS member_count
    FROM study_rooms r
    JOIN users h ON h.id = r.host_id
    LEFT JOIN study_groups g ON g.id = r.group_id
`;

async function loadRoom(id) {
    const r = await pool.query(`${ROOM_SELECT} WHERE r.id = $1`, [id]);
    return r.rows[0] || null;
}
async function membership(roomId, userId) {
    const r = await pool.query('SELECT status FROM room_members WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
    return r.rows[0] || null;
}

async function joinRoom(room, userId) {
    if (!isLive(room)) throw new AppError('This study room has ended.', 410);
    const already = await membership(room.id, userId);
    if (already) return { alreadyMember: true };
    if (parseInt(room.member_count, 10) >= MAX_ROOM_MEMBERS) throw new AppError('This study room is full.', 409);
    await pool.query("INSERT INTO room_members (room_id, user_id, status) VALUES ($1, $2, 'joined')", [room.id, userId]);
    if (room.host_id !== userId) {
        await notifyUser(room.host_id, { category: 'rooms', kind: 'room_joined', title: `${await nameOf(userId)} joined your study room`, body: room.title, link: 'community:rooms' });
    }
    return { alreadyMember: false };
}

router.post('/rooms', async (req, res) => {
    const { durationMin, groupId } = req.body;
    if (!isIntInRange(durationMin, 5, 720)) throw new AppError('Choose a session length between 5 minutes and 12 hours.', 400);
    const me = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const title = (req.body.title === undefined || String(req.body.title).trim() === '')
        ? `${me.rows[0].name}'s study session`
        : cleanName(req.body.title, 2, 60, 'Room title');
    let gid = null;
    if (groupId !== undefined && groupId !== null) {
        if (!Number.isInteger(groupId) || !(await myGroup(groupId, req.user.id))) throw new AppError('You can only link a room to a group you belong to.', 403);
        gid = groupId;
    }
    const expires = new Date(Date.now() + ROOM_LIFETIME_MS).toISOString();
    const id = await insertWithCode('R', async (code) => {
        const r = await pool.query(
            'INSERT INTO study_rooms (host_id, group_id, title, duration_min, invite_code, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [req.user.id, gid, title, durationMin, code, expires]);
        return r.rows[0].id;
    });
    await pool.query("INSERT INTO room_members (room_id, user_id, status) VALUES ($1, $2, 'joined')", [id, req.user.id]);
    // Tell friends (and the linked group's members) a room is open
    const created = roomRow(await loadRoom(id), { myStatus: 'joined' });
    let audience = await friendIdsOf(req.user.id);
    if (gid) audience = audience.concat((await pool.query('SELECT user_id FROM group_members WHERE group_id = $1', [gid])).rows.map(x => x.user_id));
    await notifyMany(audience, {
        category: 'rooms', kind: 'room_created', title: `${created.hostName} opened a study room`,
        body: `${created.title} · ${created.durationMin} min. Join in.`, link: 'community:rooms'
    }, req.user.id);
    res.status(201).json({ room: created });
});

router.post('/rooms/join', async (req, res) => {
    const parsed = normaliseCode(req.body.code);
    if (!parsed || (parsed.prefix && parsed.prefix !== 'R')) throw new AppError('That does not look like a study room code.', 400);
    const found = await pool.query('SELECT id FROM study_rooms WHERE invite_code = $1', [`R-${parsed.body}`]);
    if (!found.rows[0]) throw new AppError('No study room has that code.', 404);
    const room = await loadRoom(found.rows[0].id);
    const { alreadyMember } = await joinRoom(room, req.user.id);
    res.status(alreadyMember ? 200 : 201).json({ room: roomRow(await loadRoom(room.id), { myStatus: (await membership(room.id, req.user.id)).status }), alreadyMember });
});

// Rooms I am in, plus open rooms from friends and from my groups that I can hop into
router.get('/rooms', async (req, res) => {
    const me = req.user.id;
    const mine = await pool.query(`${ROOM_SELECT} JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1 ORDER BY r.created_at DESC`, [me]);
    const myStatus = await pool.query('SELECT room_id, status FROM room_members WHERE user_id = $1', [me]);
    const statusOf = new Map(myStatus.rows.map(x => [x.room_id, x.status]));
    const rooms = mine.rows.filter(isLive).map(r => roomRow(r, { myStatus: statusOf.get(r.id), isHost: r.host_id === me }));
    const memberOf = new Set(mine.rows.map(r => r.id));

    const friendIds = (await pool.query(`
        SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
        FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`, [me])).rows.map(x => x.fid);
    const groupIds = (await pool.query('SELECT group_id FROM group_members WHERE user_id = $1', [me])).rows.map(x => x.group_id);

    const joinable = new Map();
    if (friendIds.length) {
        const r = await pool.query(`${ROOM_SELECT} WHERE r.host_id IN (${placeholders(friendIds.length)}) ORDER BY r.created_at DESC`, friendIds);
        r.rows.filter(x => isLive(x) && !memberOf.has(x.id)).forEach(x => joinable.set(x.id, roomRow(x, { via: 'friend' })));
    }
    if (groupIds.length) {
        const r = await pool.query(`${ROOM_SELECT} WHERE r.group_id IN (${placeholders(groupIds.length)}) ORDER BY r.created_at DESC`, groupIds);
        r.rows.filter(x => isLive(x) && !memberOf.has(x.id)).forEach(x => joinable.set(x.id, roomRow(x, { via: 'group' })));
    }
    res.json({ rooms, joinable: [...joinable.values()] });
});

// Hop into a friend's or group mate's room without typing a code
router.post('/rooms/:id/join', async (req, res) => {
    const id = parseId(req.params.id);
    const room = id && await loadRoom(id);
    if (!room) throw new AppError('Study room not found.', 404);
    const me = req.user.id;
    const allowed = room.host_id === me || await membership(room.id, me) || await areFriends(me, room.host_id) ||
        (room.group_id && await myGroup(room.group_id, me));
    if (!allowed) throw new AppError('Join this room with its invite code.', 403);
    const { alreadyMember } = await joinRoom(room, me);
    res.status(alreadyMember ? 200 : 201).json({ room: roomRow(await loadRoom(id), { myStatus: (await membership(id, me)).status }), alreadyMember });
});

router.get('/rooms/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const room = id && await loadRoom(id);
    const mem = room && await membership(room.id, req.user.id);
    if (!room || !mem) throw new AppError('Study room not found.', 404);
    const m = await pool.query('SELECT user_id, status, joined_at, updated_at FROM room_members WHERE room_id = $1 ORDER BY joined_at ASC', [id]);
    const users = new Map((await usersByIds(m.rows.map(x => x.user_id))).map(u => [u.id, u]));
    const members = m.rows.map(x => ({
        id: x.user_id, name: users.get(x.user_id).name, faculty: users.get(x.user_id).faculty,
        status: x.status, isHost: x.user_id === room.host_id, isMe: x.user_id === req.user.id, updatedAt: x.updated_at
    }));
    res.json({
        room: roomRow(room, { myStatus: mem.status, isHost: room.host_id === req.user.id }),
        members,
        summary: ROOM_STATUSES.reduce((acc, s) => ({ ...acc, [s]: members.filter(x => x.status === s).length }), {})
    });
});

router.post('/rooms/:id/status', async (req, res) => {
    const id = parseId(req.params.id);
    const status = req.body.status;
    if (!ROOM_STATUSES.includes(status)) throw new AppError(`status must be one of: ${ROOM_STATUSES.join(', ')}.`, 400);
    const room = id && await loadRoom(id);
    const mem = room && await membership(room.id, req.user.id);
    if (!room || !mem) throw new AppError('Study room not found.', 404);
    if (!isLive(room) && status !== 'completed' && status !== 'interrupted') throw new AppError('This study room has ended.', 410);
    if (mem.status === status) return res.json({ status });
    if (!ROOM_MOVES[mem.status].includes(status)) throw new AppError(`You cannot go from "${mem.status}" to "${status}".`, 409);
    await pool.query('UPDATE room_members SET status = $1, updated_at = $2 WHERE room_id = $3 AND user_id = $4',
        [status, new Date().toISOString(), id, req.user.id]);
    // Tell the rest of the room when someone starts or finishes
    const verbs = { focusing: 'started focusing', completed: 'finished their session' };
    if (verbs[status]) {
        const others = (await pool.query('SELECT user_id FROM room_members WHERE room_id = $1', [id])).rows.map(x => x.user_id);
        await notifyMany(others, {
            category: 'rooms', kind: `room_${status}`, title: `${await nameOf(req.user.id)} ${verbs[status]}`, body: room.title, link: 'community:rooms'
        }, req.user.id);
    }
    res.json({ status });
});

router.post('/rooms/:id/leave', async (req, res) => {
    const id = parseId(req.params.id);
    const room = id && await loadRoom(id);
    const mem = room && await membership(room.id, req.user.id);
    if (!room || !mem) throw new AppError('Study room not found.', 404);
    await pool.query('DELETE FROM room_members WHERE room_id = $1 AND user_id = $2', [id, req.user.id]);
    // The host leaving ends the room for everyone
    if (room.host_id === req.user.id) await pool.query("UPDATE study_rooms SET status = 'closed' WHERE id = $1", [id]);
    res.json({ status: 'left', roomClosed: room.host_id === req.user.id });
});

router.post('/rooms/:id/close', async (req, res) => {
    const id = parseId(req.params.id);
    const room = id && await loadRoom(id);
    if (!room || !(await membership(room.id, req.user.id))) throw new AppError('Study room not found.', 404);
    if (room.host_id !== req.user.id) throw new AppError('Only the host can end the room.', 403);
    await pool.query("UPDATE study_rooms SET status = 'closed' WHERE id = $1", [id]);
    res.json({ status: 'closed' });
});

// ─── Invite preview: what does this code open? (used by invite links and QR scans) ─
router.get('/invite/:code', async (req, res) => {
    const parsed = normaliseCode(req.params.code);
    if (!parsed) throw new AppError('That invite code is not valid.', 400);
    const me = req.user.id;
    const kinds = parsed.prefix ? [parsed.prefix] : ['F', 'G', 'R'];
    for (const k of kinds) {
        const code = `${k}-${parsed.body}`;
        if (k === 'F') {
            const r = await pool.query('SELECT u.id, u.name, u.faculty FROM user_codes c JOIN users u ON u.id = c.user_id WHERE c.code = $1', [code]);
            if (r.rows[0]) {
                const rel = await relationBetween(me, r.rows[0].id);
                return res.json({
                    kind: 'friend', code, name: r.rows[0].name, faculty: r.rows[0].faculty,
                    isMe: r.rows[0].id === me,
                    relation: !rel ? 'none' : rel.status === 'accepted' ? 'friends' : rel.requester_id === me ? 'requested' : 'incoming'
                });
            }
        } else if (k === 'G') {
            const r = await pool.query(`SELECT g.id, g.name, o.name AS owner_name,
                    (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
                FROM study_groups g JOIN users o ON o.id = g.owner_id WHERE g.invite_code = $1`, [code]);
            if (r.rows[0]) return res.json({
                kind: 'group', code, name: r.rows[0].name, ownerName: r.rows[0].owner_name,
                memberCount: parseInt(r.rows[0].member_count, 10), alreadyMember: !!(await myGroup(r.rows[0].id, me))
            });
        } else {
            const r = await pool.query('SELECT id FROM study_rooms WHERE invite_code = $1', [code]);
            if (r.rows[0]) {
                const room = await loadRoom(r.rows[0].id);
                return res.json({
                    kind: 'room', code, title: room.title, hostName: room.host_name, durationMin: room.duration_min,
                    memberCount: parseInt(room.member_count, 10), live: isLive(room), alreadyMember: !!(await membership(room.id, me))
                });
            }
        }
    }
    throw new AppError('No friend, group or study room matches that code.', 404);
});

module.exports = router;
