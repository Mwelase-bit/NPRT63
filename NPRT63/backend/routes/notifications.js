// routes/notifications.js - the notification centre and Web Push subscriptions.
//
//   GET    /api/notifications             latest notifications + unread count
//   POST   /api/notifications/read        mark some (ids) or all as read
//   DELETE /api/notifications             clear the student's notifications
//   GET    /api/notifications/prefs       which categories are on
//   PUT    /api/notifications/prefs       switch one category on or off
//   GET    /api/notifications/push/key    the public key a browser needs to subscribe
//   POST   /api/notifications/push/subscribe     save a browser subscription
//   POST   /api/notifications/push/unsubscribe   forget one
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');
const { parseId } = require('../middleware/validate');
const { CATEGORIES, getPublicKey, pushEnabled } = require('../utils/notify');

router.use(authenticate);

const MAX_DEVICES_PER_USER = 10;     // one student cannot pile up unlimited subscriptions
const MAX_LIST = 50;

// ─── The list ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), MAX_LIST);
    const list = await pool.query(`
        SELECT id, category, kind, title, body, link, created_at, read_at
        FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT $2`, [req.user.id, limit]);
    const unread = await pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    res.json({
        notifications: list.rows.map(n => ({
            id: n.id, category: n.category, kind: n.kind, title: n.title, body: n.body, link: n.link,
            createdAt: n.created_at, read: n.read_at !== null && n.read_at !== undefined
        })),
        unread: parseInt(unread.rows[0].n, 10)
    });
});

router.post('/read', async (req, res) => {
    const { ids, all } = req.body || {};
    const now = new Date().toISOString();
    if (all === true) {
        await pool.query('UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL', [now, req.user.id]);
        return res.json({ status: 'ok' });
    }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every(i => Number.isInteger(i) && i > 0)) {
        throw new AppError('Send ids (a list of up to 100 numbers) or all: true.', 400);
    }
    const marks = ids.map((_, i) => `$${i + 3}`).join(', ');
    await pool.query(`UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL AND id IN (${marks})`, [now, req.user.id, ...ids]);
    res.json({ status: 'ok' });
});

router.delete('/', async (req, res) => {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ status: 'cleared' });
});

// ─── Category switches ────────────────────────────────────────────────────────
router.get('/prefs', async (req, res) => {
    const r = await pool.query('SELECT category, enabled FROM notification_prefs WHERE user_id = $1', [req.user.id]);
    const set = new Map(r.rows.map(x => [x.category, x.enabled === 1 || x.enabled === true]));
    res.json({
        prefs: Object.entries(CATEGORIES).map(([id, label]) => ({ id, label, enabled: set.has(id) ? set.get(id) : true }))
    });
});

router.put('/prefs', async (req, res) => {
    const { category, enabled } = req.body || {};
    if (!CATEGORIES[category]) throw new AppError(`category must be one of: ${Object.keys(CATEGORIES).join(', ')}.`, 400);
    if (typeof enabled !== 'boolean') throw new AppError('enabled must be true or false.', 400);
    await pool.query(`
        INSERT INTO notification_prefs (user_id, category, enabled) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, category) DO UPDATE SET enabled = EXCLUDED.enabled
    `, [req.user.id, category, enabled ? 1 : 0]);
    res.json({ category, enabled });
});

// ─── Web Push ─────────────────────────────────────────────────────────────────
router.get('/push/key', (req, res) => {
    const key = getPublicKey();
    // 200 with enabled:false (not an error) so the app can simply hide the push switch
    res.json({ enabled: !!key && pushEnabled(), publicKey: key });
});

router.post('/push/subscribe', async (req, res) => {
    const sub = req.body || {};
    const keys = sub.keys || {};
    const okUrl = typeof sub.endpoint === 'string' && /^https:\/\/\S{10,1000}$/.test(sub.endpoint);
    if (!okUrl || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
        throw new AppError('That does not look like a valid push subscription.', 400);
    }
    const mine = await pool.query('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = $1 AND endpoint <> $2', [req.user.id, sub.endpoint]);
    if (parseInt(mine.rows[0].n, 10) >= MAX_DEVICES_PER_USER) throw new AppError(`You can receive push on at most ${MAX_DEVICES_PER_USER} devices.`, 400);
    // The same browser re-subscribing (or a different student on a shared browser) replaces the old row
    await pool.query(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
        ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `, [req.user.id, sub.endpoint, keys.p256dh, keys.auth]);
    res.status(201).json({ status: 'subscribed' });
});

router.post('/push/unsubscribe', async (req, res) => {
    const endpoint = req.body && req.body.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) throw new AppError('endpoint is required.', 400);
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [req.user.id, endpoint]);
    res.json({ status: 'unsubscribed' });
});

module.exports = router;
