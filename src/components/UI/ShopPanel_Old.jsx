const { useState } = React;
const ShopPanel = ({ gameState, rewards }) => {
    const [selectedCategory, setSelectedCategory] = useState('outfit');

    const categories = [
        { id: 'outfit', name: 'Outfits' },
        { id: 'tool', name: 'Tools' },
        { id: 'hat', name: 'Hats' },
        { id: 'house', name: 'Houses' },
        { id: 'booster', name: 'Boosters' }
    ];

    return (
        <div className="shop-panel" style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', background: '#222' }}>
            <h2>Builder's Shop</h2>

            <div className="coins-display" style={{ marginBottom: '20px' }}>
                <div className="current-coins" style={{ color: 'gold', fontWeight: 'bold' }}>
                    $ 100 Coins
                </div>
            </div>

            {/* Old Plain Text Category Tabs */}
            <div className="shop-categories" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #555', paddingBottom: '10px', marginBottom: '20px' }}>
                {categories.map(category => (
                    <button
                        key={category.id}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: selectedCategory === category.id ? '#fff' : '#888',
                            fontWeight: selectedCategory === category.id ? 'bold' : 'normal',
                            cursor: 'pointer',
                            textDecoration: selectedCategory === category.id ? 'underline' : 'none'
                        }}
                        onClick={() => setSelectedCategory(category.id)}
                    >
                        {category.name}
                    </button>
                ))}
            </div>

            <div className="shop-items" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: '#333', padding: '15px', borderRadius: '8px' }}>
                    <h3>Architect Suit</h3>
                    <p style={{ fontSize: '0.9em', color: '#ccc' }}>Sharp blazer for serious builders.</p>
                    <button style={{ width: '100%', padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Buy - 300</button>
                </div>
                <div style={{ background: '#333', padding: '15px', borderRadius: '8px' }}>
                    <h3>Wizard Robes</h3>
                    <p style={{ fontSize: '0.9em', color: '#ccc' }}>Mystical robes imbued with focus energy.</p>
                    <button style={{ width: '100%', padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Buy - 500</button>
                </div>
            </div>
        </div>
    );
};

window.ShopPanel = ShopPanel;
