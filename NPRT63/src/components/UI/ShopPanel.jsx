// ShopPanel.jsx - spend coins on outfits, hats, tools, houses and boosters.
//
//   * Outfits, hats and tools are bought once and then equipped from here (or the Profile).
//   * Houses are bought once and unlock a house type.
//   * Boosters are consumables: buy as many as you like; the shop shows how many you hold.
// Messages appear inside the panel (no browser pop-ups), and every purchase is checked
// and charged by the server in one transaction.
const { useState, useEffect, useRef, useCallback } = React;

const SHOP_CATEGORIES = [
    { id: 'outfit', name: 'Outfits', slot: 'outfit' },
    { id: 'hat', name: 'Hats', slot: 'hat' },
    { id: 'tool', name: 'Tools', slot: 'tool' },
    { id: 'house', name: 'Houses', slot: null },
    { id: 'booster', name: 'Boosters', slot: null }
];

const ShopPanel = ({ gameState, rewards }) => {
    const [category, setCategory] = useState('outfit');
    const [shop, setShop] = useState(null);          // { category: [items] }
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [notice, setNotice] = useState(null);      // { text, type }
    const [busyItem, setBusyItem] = useState('');
    const noticeTimer = useRef(null);

    const say = useCallback((text, type) => {
        setNotice({ text, type: type || 'ok' });
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 4500);
    }, []);

    const load = useCallback(async () => {
        if (!gameState || !gameState.token) { setLoading(false); return; }
        try {
            const res = await window.api.shop.getAll();
            setShop(res.categories || {});
            setLoadError('');
        } catch (err) {
            console.error('Failed to load shop items', err);
            setLoadError(err.message || 'Could not load the shop.');
        } finally {
            setLoading(false);
        }
    }, [gameState && gameState.token]);

    useEffect(() => { load(); }, [load]);

    const equippedId = (item) => {
        const slot = (SHOP_CATEGORIES.find(c => c.id === item.category) || {}).slot;
        return slot ? gameState.builderCustomization[slot] === item.itemId : false;
    };

    const buy = async (item) => {
        setBusyItem(item.itemId);
        try {
            await window.api.shop.buy(item.itemId);
            if (rewards.syncWithBackend) await rewards.syncWithBackend();      // balance comes from the server
            if (item.category === 'house') gameState.unlockHouseType(item.itemId);
            // Wearable items are put on straight away so the student sees them
            const slot = (SHOP_CATEGORIES.find(c => c.id === item.category) || {}).slot;
            if (slot) gameState.updateBuilderCustomization(slot, item.itemId);
            await load();
            say(item.category === 'booster' ? `${item.name} added to your boosters.` : `You bought ${item.name}${slot ? ' and put it on' : ''}.`);
        } catch (err) {
            say(err.message || 'Purchase failed.', 'error');
        } finally {
            setBusyItem('');
        }
    };

    const equip = (item) => {
        const slot = (SHOP_CATEGORIES.find(c => c.id === item.category) || {}).slot;
        if (!slot) return;
        gameState.updateBuilderCustomization(slot, item.itemId);
        say(`${item.name} equipped.`);
    };

    const items = shop && shop[category] ? shop[category] : [];

    return (
        <div className="shop-panel mn-panel">
            <div className="pf-top">
                <h2>Shop</h2>
                <div className="sh-balance" aria-label={`${rewards.coins} coins`}><strong>{rewards.coins}</strong> coins</div>
            </div>

            <div className="pf-tabs" role="tablist">
                {SHOP_CATEGORIES.map(c => (
                    <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={`pf-tab ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>{c.name}</button>
                ))}
            </div>

            {notice && <div className={`so-notice so-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
            {loadError && <div className="pf-error" role="alert">{loadError} <button type="button" className="pf-btn" onClick={load}>Try again</button></div>}
            {loading && <div className="so-empty">Loading the shop…</div>}
            {!loading && !loadError && items.length === 0 && <div className="pf-empty">Nothing for sale here yet.</div>}

            <div className="sh-grid">
                {items.map(item => {
                    const wearable = !!(SHOP_CATEGORIES.find(c => c.id === item.category) || {}).slot;
                    const equipped = wearable && equippedId(item);
                    const poor = rewards.coins < item.price;
                    return (
                        <div key={item.itemId} className={`sh-item ${item.owned ? 'is-owned' : ''}`}>
                            <div className="sh-item-top">
                                <div className="sh-item-name">{item.name}{item.isPremium && <span className="so-tag">Premium</span>}</div>
                                {item.category === 'booster'
                                    ? <span className="pf-chip">You have {item.charges || 0}</span>
                                    : item.owned && <span className="pf-chip">Owned</span>}
                            </div>
                            <p className="sh-item-desc">{item.description}</p>
                            <div className="sh-item-foot">
                                <div className="sh-price"><strong>{item.price}</strong> coins</div>
                                {item.owned && wearable ? (
                                    <button type="button" className={`pf-btn ${equipped ? '' : 'pf-btn--primary'}`} disabled={equipped} onClick={() => equip(item)}>{equipped ? 'Equipped' : 'Equip'}</button>
                                ) : item.owned ? (
                                    <button type="button" className="pf-btn" disabled>Unlocked</button>
                                ) : (
                                    <button type="button" className="pf-btn pf-btn--primary" disabled={poor || busyItem === item.itemId} onClick={() => buy(item)}
                                        title={poor ? `You need ${item.price - rewards.coins} more coins` : ''}>
                                        {busyItem === item.itemId ? 'Buying…' : poor ? `Need ${item.price - rewards.coins} more` : item.category === 'booster' ? 'Buy' : 'Buy'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="pf-note">Earn coins by focusing: 1 coin per minute, plus streak and daily bonuses.</p>
        </div>
    );
};

window.ShopPanel = ShopPanel;
