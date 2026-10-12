// routes/shop.js — Shop catalogue and item purchase
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/shop — List all shop items (with ownership flag) ─────────────────
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [itemsRes, ownedRes] = await Promise.all([
            pool.query('SELECT * FROM shop_items ORDER BY category, price'),
            pool.query('SELECT item_id FROM user_items WHERE user_id = $1', [userId])
        ]);

        const owned = new Set(ownedRes.rows.map(r => r.item_id));

        // Group by category
        const grouped = {};
        for (const item of itemsRes.rows) {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push({
                itemId:      item.item_id,
                name:        item.name,
                description: item.description,
                category:    item.category,
                price:       item.price,
                emoji:       item.emoji,
                isPremium:   item.is_premium === 1,
                owned:       owned.has(item.item_id)
            });
        }

        res.json({ categories: grouped });
    } catch (err) {
        console.error('Shop list error:', err);
        res.status(500).json({ error: 'Server error fetching shop items.' });
    }
});

// ─── POST /api/shop/buy — Purchase an item ─────────────────────────────────────
router.post('/buy', authenticate, async (req, res) => {
    const { itemId } = req.body;
    const userId = req.user.id;

    if (!itemId) {
        return res.status(400).json({ error: 'itemId is required.' });
    }
    if (typeof itemId !== 'string' || itemId.length > 64) {
        return res.status(400).json({ error: 'itemId must be a short text id.' });
    }

    const client = await pool.connect();
    try {
        const itemRes = await client.query('SELECT * FROM shop_items WHERE item_id = $1', [itemId]);
        if (itemRes.rows.length === 0) {
            return res.status(404).json({ error: `Item '${itemId}' not found in the shop.` });
        }
        const item = itemRes.rows[0];

        // Everything below runs in ONE transaction. Previously the balance was
        // checked before BEGIN, so two quick purchases could both pass the check
        // and drive the balance negative.
        await client.query('BEGIN');

        const alreadyRes = await client.query(
            'SELECT id FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, itemId]);
        if (alreadyRes.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'You already own this item.' });
        }

        // Conditional debit: only succeeds if the balance still covers the price
        const debit = await client.query(
            'UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1 RETURNING coins',
            [item.price, userId]
        );
        if (debit.rows.length === 0) {
            await client.query('ROLLBACK');
            const bal = await client.query('SELECT coins FROM users WHERE id = $1', [userId]);
            const coins = bal.rows[0] ? bal.rows[0].coins : 0;
            return res.status(402).json({ error: `Not enough coins. You have ${coins} but this costs ${item.price}.` });
        }

        await client.query('INSERT INTO user_items (user_id, item_id) VALUES ($1, $2)', [userId, itemId]);
        await client.query('COMMIT');

        res.status(201).json({
            message:        `You purchased "${item.name}"! Enjoy your new item.`,
            itemId:         item.item_id,
            coinsSpent:     item.price,
            coinsRemaining: debit.rows[0].coins
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') {
            return res.status(409).json({ error: 'You already own this item.' });
        }
        console.error('Shop purchase error:', err);
        res.status(500).json({ error: 'Server error processing purchase.' });
    } finally {
        client.release();
    }
});

// ─── GET /api/shop/owned — List current user's purchased items ─────────────────
router.get('/owned', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT ui.item_id, ui.purchased_at, si.name, si.category, si.emoji
            FROM user_items ui
            JOIN shop_items si ON si.item_id = ui.item_id
            WHERE ui.user_id = $1
            ORDER BY ui.purchased_at DESC
        `, [userId]);

        res.json({ owned: result.rows });
    } catch (err) {
        console.error('Owned items error:', err);
        res.status(500).json({ error: 'Server error fetching owned items.' });
    }
});

module.exports = router;
