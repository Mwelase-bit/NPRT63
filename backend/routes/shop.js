// routes/shop.js — Shop catalogue and item purchase
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/shop — List all shop items (with ownership flag) ────────────────
router.get('/', authenticate, (req, res) => {
    try {
        const userId = req.user.id;

        const items = db.prepare('SELECT * FROM shop_items ORDER BY category, price').all();

        const owned = new Set(
            db.prepare('SELECT item_id FROM user_items WHERE user_id = ?')
                .all(userId)
                .map(r => r.item_id)
        );

        // Group by category for convenience
        const grouped = {};
        for (const item of items) {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push({
                itemId: item.item_id,
                name: item.name,
                description: item.description,
                category: item.category,
                price: item.price,
                emoji: item.emoji,
                isPremium: item.is_premium === 1,
                owned: owned.has(item.item_id)
            });
        }

        res.json({ categories: grouped });
    } catch (err) {
        console.error('Shop list error:', err);
        res.status(500).json({ error: 'Server error fetching shop items.' });
    }
});

// ─── POST /api/shop/buy — Purchase an item ────────────────────────────────────
router.post('/buy', authenticate, (req, res) => {
    try {
        const { itemId } = req.body;
        const userId = req.user.id;

        if (!itemId) {
            return res.status(400).json({ error: 'itemId is required.' });
        }

        // Verify item exists
        const item = db.prepare('SELECT * FROM shop_items WHERE item_id = ?').get(itemId);
        if (!item) {
            return res.status(404).json({ error: `Item '${itemId}' not found in the shop.` });
        }

        // Check not already owned
        const already = db.prepare('SELECT id FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, itemId);
        if (already) {
            return res.status(409).json({ error: 'You already own this item.' });
        }

        // Check coins balance
        const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
        if (user.coins < item.price) {
            return res.status(402).json({
                error: `Not enough coins. You have ${user.coins} but this costs ${item.price}.`
            });
        }

        // Perform purchase atomically
        const purchase = db.transaction(() => {
            db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(item.price, userId);
            db.prepare('INSERT INTO user_items (user_id, item_id) VALUES (?, ?)').run(userId, itemId);
        });
        purchase();

        const updatedUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);

        res.status(201).json({
            message: `You purchased "${item.name}"! Enjoy your new item.`,
            itemId: item.item_id,
            coinsSpent: item.price,
            coinsRemaining: updatedUser.coins
        });
    } catch (err) {
        console.error('Shop purchase error:', err);
        res.status(500).json({ error: 'Server error processing purchase.' });
    }
});

// ─── GET /api/shop/owned — List current user's purchased items ────────────────
router.get('/owned', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const owned = db.prepare(`
            SELECT ui.item_id, ui.purchased_at, si.name, si.category, si.emoji
            FROM user_items ui
            JOIN shop_items si ON si.item_id = ui.item_id
            WHERE ui.user_id = ?
            ORDER BY ui.purchased_at DESC
        `).all(userId);

        res.json({ owned });
    } catch (err) {
        console.error('Owned items error:', err);
        res.status(500).json({ error: 'Server error fetching owned items.' });
    }
});

module.exports = router;
