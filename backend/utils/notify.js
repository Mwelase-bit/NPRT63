// utils/notify.js - the one place that creates notifications.
//
// Every notification does two things:
//   1. It is stored in the `notifications` table, so it shows in the in-app
//      notification centre even if the student never allows browser push.
//   2. It is sent as a Web Push message to every device the student subscribed,
//      so it arrives even when BUILDHAUS is closed.
//
// A notification never breaks the action that caused it: every function here
// catches its own errors, logs them and carries on.
const fs = require('fs');
const path = require('path');
const { pool } = require('../database');

// ─── Categories the student can switch on or off ──────────────────────────────
const CATEGORIES = {
    friends: 'Friend requests and friends starting sessions',
    rooms: 'Study rooms',
    groups: 'Class groups',
    achievements: 'Achievements and streaks',
    system: 'Everything else'
};

// ─── Web Push (VAPID) setup ───────────────────────────────────────────────────
// Production: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (see README). Development: keys
// are created once and saved to backend/.vapid.json so subscriptions survive restarts.
let webpush = null;
let vapid = null;

function loadVapidKeys() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    }
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return null;
    const file = path.join(__dirname, '..', '.vapid.json');
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
        const keys = webpush.generateVAPIDKeys();
        fs.writeFileSync(file, JSON.stringify(keys), 'utf8');
        return keys;
    } catch (err) {
        console.warn('Push: could not read or save development VAPID keys:', err.message);
        return null;
    }
}

function initPush() {
    try {
        webpush = require('web-push');
    } catch (err) {
        console.warn('Push: the web-push package is not installed. In-app notifications still work.');
        return;
    }
    vapid = loadVapidKeys();
    if (!vapid) {
        if (process.env.NODE_ENV === 'production') console.warn('Push: VAPID keys are not set, so browser push is off. In-app notifications still work.');
        return;
    }
    try {
        webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:buildhaus@localhost.invalid', vapid.publicKey, vapid.privateKey);
    } catch (err) {
        console.warn('Push: the VAPID keys are invalid:', err.message);
        vapid = null;
    }
}
initPush();

// The function that actually delivers one push message. Tests swap it for a fake.
let sender = (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 3600 });
// Tests install a fake sender, which also counts as "push is available"
let testSender = false;
const setSender = (fn) => { sender = fn; testSender = true; };

const getPublicKey = () => (vapid ? vapid.publicKey : null);
const pushEnabled = () => !!webpush && (!!vapid || testSender);

// ─── Preferences ──────────────────────────────────────────────────────────────
// A category is on unless the student switched it off.
async function isEnabled(userId, category) {
    const r = await pool.query('SELECT enabled FROM notification_prefs WHERE user_id = $1 AND category = $2', [userId, category]);
    return !r.rows[0] || r.rows[0].enabled === 1 || r.rows[0].enabled === true;
}

// ─── Sending ──────────────────────────────────────────────────────────────────
async function pushToDevices(userId, payload) {
    const subs = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
    const body = JSON.stringify(payload);
    for (const s of subs.rows) {
        try {
            await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        } catch (err) {
            // 404 / 410 mean the browser has dropped this subscription: forget it
            if (err && (err.statusCode === 404 || err.statusCode === 410)) {
                await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => { });
            } else {
                console.warn(`Push to subscription ${s.id} failed:`, err && err.message ? err.message : err);
            }
        }
    }
}

/**
 * Notify one student.
 * @param {number} userId
 * @param {{category: string, kind: string, title: string, body?: string, link?: string, push?: boolean}} n
 *   category - one of CATEGORIES (decides which preference switch applies)
 *   kind     - short machine name, e.g. 'friend_request'
 *   link     - where tapping it goes, e.g. 'community:friends'
 *   push     - false stores it in the app only (used for the student's own events)
 * @returns {Promise<boolean>} true if a notification was created
 */
async function notifyUser(userId, n) {
    try {
        if (!userId || !n || !n.title) return false;
        const category = CATEGORIES[n.category] ? n.category : 'system';
        if (!(await isEnabled(userId, category))) return false;

        const ins = await pool.query(
            'INSERT INTO notifications (user_id, category, kind, title, body, link) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [userId, category, String(n.kind || 'info').slice(0, 40), String(n.title).slice(0, 120), n.body ? String(n.body).slice(0, 240) : null, n.link ? String(n.link).slice(0, 120) : null]
        );
        if (n.push !== false && pushEnabled()) {
            await pushToDevices(userId, {
                id: ins.rows[0].id, title: n.title, body: n.body || '', link: n.link || '', tag: `${category}-${n.kind || 'info'}`
            });
        }
        return true;
    } catch (err) {
        console.warn('Notification failed (the action itself still succeeded):', err && err.message ? err.message : err);
        return false;
    }
}

/** Notify several students at once (skips duplicates and the actor). */
async function notifyMany(userIds, n, exceptUserId) {
    const unique = [...new Set((userIds || []).filter(id => id && id !== exceptUserId))];
    let sent = 0;
    for (const id of unique) { if (await notifyUser(id, n)) sent++; }
    return sent;
}

// ─── Helpers other routes use to find who to tell ─────────────────────────────
async function friendIdsOf(userId) {
    const r = await pool.query(`
        SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
        FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`, [userId]);
    return r.rows.map(x => x.fid);
}

async function nameOf(userId) {
    const r = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    return r.rows[0] ? r.rows[0].name : 'A friend';
}

// "Friend started a session" style notices are limited to one per student per 10 minutes
// so a run of short sessions cannot flood their friends.
const lastBroadcast = new Map();
const BROADCAST_COOLDOWN_MS = 10 * 60 * 1000;
function broadcastAllowed(userId, key) {
    const k = `${key}:${userId}`;
    const now = Date.now();
    if (now - (lastBroadcast.get(k) || 0) < BROADCAST_COOLDOWN_MS) return false;
    lastBroadcast.set(k, now);
    if (lastBroadcast.size > 5000) {               // keep the map small on a long-running server
        for (const [key2, t] of lastBroadcast) if (now - t > BROADCAST_COOLDOWN_MS) lastBroadcast.delete(key2);
    }
    return true;
}
const resetBroadcastLimits = () => lastBroadcast.clear();

module.exports = {
    CATEGORIES, notifyUser, notifyMany, friendIdsOf, nameOf, broadcastAllowed, resetBroadcastLimits,
    getPublicKey, pushEnabled, setSender
};
