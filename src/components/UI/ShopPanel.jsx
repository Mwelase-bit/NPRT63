const { useState, useEffect, useRef, useCallback, useMemo } = React;
const ShopPanel = ({ gameState, rewards }) => {
    const [selectedCategory, setSelectedCategory] = useState('outfit');
    const [shopData, setShopData] = useState(null);
    const [loading, setLoading] = useState(true);

    const categories = [
        { id: 'outfit', name: 'Outfits', icon: 'shirt' },
        { id: 'tool', name: 'Tools', icon: 'tool' },
        { id: 'hat', name: 'Hats', icon: 'crown' },
        { id: 'house', name: 'Houses', icon: 'home' },
        { id: 'booster', name: 'Boosters', icon: 'zap' }
    ];

    // Trigger feather icons after render
    useEffect(() => {
        setTimeout(() => { if (window.feather) feather.replace(); }, 50);
    });

    useEffect(() => {
        const fetchShop = async () => {
            try {
                if (!gameState?.token) {
                    setLoading(false);
                    return;
                }
                const res = await window.api.shop.getAll();
                setShopData(res.categories);
            } catch (err) {
                console.error("Failed to load shop items", err);
            } finally {
                setLoading(false);
            }
        };
        fetchShop();
    }, [gameState?.token]);

    const handlePurchase = async (item) => {
        if (!item.owned && rewards.coins >= item.price) {
            try {
                // Backend transaction logic
                await window.api.shop.buy(item.itemId);

                // Sync coins and stats with backend again
                if (rewards.syncWithBackend) {
                    rewards.syncWithBackend();
                } else {
                    rewards.spendCoins(item.price);
                }

                // Update local ownership immediately so button turns green without needing a refresh
                setShopData(prev => {
                    const next = { ...prev };
                    if (next[item.category]) {
                        next[item.category] = next[item.category].map(i =>
                            i.itemId === item.itemId ? { ...i, owned: true } : i
                        );
                    }
                    return next;
                });

                // Reflect immediately in gameState (for profile/3D view)
                if (item.category === 'outfit') gameState.updateBuilderCustomization('outfit', item.itemId);
                else if (item.category === 'hat') gameState.updateBuilderCustomization('hat', item.itemId);
                else if (item.category === 'tool') gameState.updateBuilderCustomization('tool', item.itemId);
                else if (item.category === 'house') gameState.unlockHouseType(item.itemId);

                alert(`Successfully purchased ${item.name}!`);
            } catch (err) {
                alert(err.message || 'Purchase failed');
            }
        } else if (item.owned) {
            // Future enhancement: Equip item logic
            alert('You already own this item!');
        } else {
            alert('Not enough coins!');
        }
    };

    if (loading) {
        return (
            <div className="shop-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <p>Loading Shop Items...</p>
            </div>
        );
    }

    const itemsToShow = shopData && shopData[selectedCategory] ? shopData[selectedCategory] : [];

    return (
        <div className="shop-panel">
            <h2>Builder's Shop</h2>

            <div className="coins-display">
                <div className="current-coins">
                    <i data-feather="dollar-sign"></i>
                    <span>{rewards.coins} Coins</span>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="shop-categories">
                {categories.map(category => (
                    <button
                        key={category.id}
                        className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(category.id)}
                    >
                        <i data-feather={category.icon}></i>
                        {category.name}
                    </button>
                ))}
            </div>

            {/* Shop Items */}
            <div className="shop-items">
                {itemsToShow.length === 0 ? (
                    <p style={{ textAlign: 'center', opacity: 0.6, gridColumn: '1 / -1', padding: '20px' }}>No items available in this category.</p>
                ) : itemsToShow.map(item => (
                    <div
                        key={item.itemId}
                        className={`shop-item ${item.owned ? 'owned' : ''}`}
                    >
                        <div className="item-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2em' }}>{item.emoji}</span>
                                {item.name}
                            </h3>
                            {item.owned && (
                                <span className="owned-badge">
                                    <i data-feather="check"></i> Owned
                                </span>
                            )}
                        </div>

                        <div className="item-content">
                            <p className="item-description">{item.description}</p>
                            {item.isPremium && (
                                <div className="item-effect" style={{ color: '#FFD700', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
                                    <i data-feather="star" style={{ width: '14px' }}></i> Premium Item
                                </div>
                            )}
                        </div>

                        <div className="item-footer">
                            <div className="item-price">
                                <i data-feather="dollar-sign"></i> <span>{item.price}</span>
                            </div>

                            <button
                                className={`btn ${item.owned ? 'btn-success' : 'btn-primary'}`}
                                onClick={() => handlePurchase(item)}
                                disabled={item.owned || rewards.coins < item.price}
                            >
                                {item.owned ? (
                                    <> <i data-feather="check"></i> Owned </>
                                ) : rewards.coins < item.price ? (
                                    <> <i data-feather="dollar-sign"></i> Need {item.price - rewards.coins} more </>
                                ) : (
                                    <> <i data-feather="shopping-cart"></i> Buy Now </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Unlock Conditions Guide */}
            <div className="unlock-guide">
                <h3>Tips</h3>
                <div className="unlock-tips">
                    <div className="tip">
                        <i data-feather="dollar-sign"></i>
                        <span>Start focus sessions to earn 1 coin per minute</span>
                    </div>
                    <div className="tip">
                        <i data-feather="zap"></i>
                        <span>Maintain a multi-day streak for huge coin bonuses</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

window.ShopPanel = ShopPanel;
