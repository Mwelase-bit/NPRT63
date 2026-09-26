const Storage = {
    KEYS: {
        GAME_STATE: 'buildersFocus_gameState',
        REWARDS: 'buildersFocus_rewards',
        SETTINGS: 'buildersFocus_settings'
    },
    
    // Game State Storage
    saveGameState: (gameState) => {
        try {
            localStorage.setItem(Storage.KEYS.GAME_STATE, JSON.stringify(gameState));
        } catch (error) {
            console.warn('Failed to save game state:', error);
        }
    },
    
    getGameState: () => {
        try {
            const saved = localStorage.getItem(Storage.KEYS.GAME_STATE);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.warn('Failed to load game state:', error);
            return null;
        }
    },
    
    // Rewards Storage
    saveRewards: (rewards) => {
        try {
            localStorage.setItem(Storage.KEYS.REWARDS, JSON.stringify(rewards));
        } catch (error) {
            console.warn('Failed to save rewards:', error);
        }
    },
    
    getRewards: () => {
        try {
            const saved = localStorage.getItem(Storage.KEYS.REWARDS);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.warn('Failed to load rewards:', error);
            return null;
        }
    },
    
    // Settings Storage
    saveSettings: (settings) => {
        try {
            localStorage.setItem(Storage.KEYS.SETTINGS, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    },
    
    getSettings: () => {
        try {
            const saved = localStorage.getItem(Storage.KEYS.SETTINGS);
            return saved ? JSON.parse(saved) : {
                soundEnabled: true,
                notifications: true,
                theme: 'light'
            };
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return {
                soundEnabled: true,
                notifications: true,
                theme: 'light'
            };
        }
    },
    
    // Clear all data
    clearAll: () => {
        try {
            Object.values(Storage.KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.warn('Failed to clear storage:', error);
            return false;
        }
    },
    
    // Export data for backup
    exportData: () => {
        try {
            const data = {};
            Object.entries(Storage.KEYS).forEach(([name, key]) => {
                const value = localStorage.getItem(key);
                if (value) {
                    data[name] = JSON.parse(value);
                }
            });
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.warn('Failed to export data:', error);
            return null;
        }
    },
    
    // Import data from backup
    importData: (dataString) => {
        try {
            const data = JSON.parse(dataString);
            Object.entries(data).forEach(([name, value]) => {
                const key = Storage.KEYS[name];
                if (key) {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            });
            return true;
        } catch (error) {
            console.warn('Failed to import data:', error);
            return false;
        }
    }
};

window.Storage = Storage;
