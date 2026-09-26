const CoinSystem = {
    // Base coin calculations
    calculateSessionCoins: (duration, streak = 0) => {
        const baseRate = 1; // 1 coin per minute
        const baseCoins = Math.floor(duration / 60) * baseRate;
        const streakBonus = Math.min(streak * 2, 50); // Max 50 bonus coins
        return Math.max(baseCoins + streakBonus, 1); // Minimum 1 coin
    },
    
    calculateStreakBonus: (streak) => {
        const milestones = [
            { days: 3, bonus: 30 },
            { days: 7, bonus: 70 },
            { days: 14, bonus: 140 },
            { days: 30, bonus: 300 },
            { days: 50, bonus: 500 },
            { days: 100, bonus: 1000 }
        ];
        
        return milestones.find(m => m.days === streak)?.bonus || 0;
    },
    
    calculateDifficultyMultiplier: (duration) => {
        if (duration >= 14400) return 3.0; // 4+ hours
        if (duration >= 7200) return 2.5;  // 2+ hours
        if (duration >= 3600) return 2.0;  // 1+ hour
        if (duration >= 1800) return 1.5;  // 30+ minutes
        if (duration >= 900) return 1.2;   // 15+ minutes
        return 1.0; // Base multiplier
    },
    
    calculateTimeOfDayBonus: () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour <= 7) return 1.2;  // Early morning bonus
        if (hour >= 22 || hour <= 2) return 1.2; // Late night bonus
        return 1.0;
    },
    
    calculateWeekendBonus: () => {
        const day = new Date().getDay();
        return (day === 0 || day === 6) ? 1.1 : 1.0; // 10% weekend bonus
    },
    
    calculatePerfectSessionBonus: (perfectStreak) => {
        return Math.min(perfectStreak * 5, 100); // Max 100 bonus
    },
    
    // Shop pricing system
    getItemPrice: (itemType, itemId, basePrices = {}) => {
        const defaultPrices = {
            outfits: {
                casual: 50,
                professional: 100,
                superhero: 500
            },
            hats: {
                cowboy: 75,
                crown: 300,
                viking: 150
            },
            tools: {
                golden_hammer: 200,
                power_drill: 150,
                blueprint: 1000
            },
            houses: {
                cottage: 0,    // Free
                townhouse: 500,
                mansion: 1000,
                castle: 2000,
                skyscraper: 5000
            }
        };
        
        const prices = { ...defaultPrices, ...basePrices };
        return prices[itemType]?.[itemId] || 0;
    },
    
    // Inflation system for long-term balance
    applyInflation: (basePrice, itemsOwned) => {
        const inflationRate = 0.1; // 10% increase per similar item owned
        return Math.floor(basePrice * (1 + inflationRate * itemsOwned));
    },
    
    // Daily bonus system
    getDailyBonus: (streak, consecutiveDays) => {
        const baseDaily = 20;
        const streakMultiplier = Math.min(streak / 7, 5); // Max 5x multiplier at 35 days
        const consecutiveBonus = Math.min(consecutiveDays * 5, 50); // Max 50 bonus
        
        return Math.floor(baseDaily * (1 + streakMultiplier) + consecutiveBonus);
    },
    
    // Achievement coin rewards
    getAchievementReward: (achievementRarity) => {
        const rewardsByRarity = {
            common: 50,
            uncommon: 100,
            rare: 300,
            epic: 750,
            legendary: 2000
        };
        
        return rewardsByRarity[achievementRarity] || 50;
    },
    
    // House completion bonuses
    getHouseCompletionBonus: (houseType, isFirstOfType = false) => {
        const baseBonuses = {
            cottage: 25,
            townhouse: 50,
            mansion: 100,
            castle: 200,
            skyscraper: 500
        };
        
        const bonus = baseBonuses[houseType] || 25;
        return isFirstOfType ? bonus * 2 : bonus; // Double bonus for first of each type
    },
    
    // Special event bonuses
    getEventMultiplier: (eventType = null) => {
        const events = {
            double_coins: 2.0,
            focus_festival: 1.5,
            builder_boost: 1.25,
            weekend_special: 1.1
        };
        
        return events[eventType] || 1.0;
    },
    
    // Coin summary for UI display
    generateCoinSummary: (sessionData) => {
        const {
            duration,
            streak,
            isWeekend,
            hour,
            houseType,
            isFirstOfType,
            perfectStreak,
            eventMultiplier = 1.0
        } = sessionData;
        
        const baseCoins = CoinSystem.calculateSessionCoins(duration, streak);
        const difficultyMultiplier = CoinSystem.calculateDifficultyMultiplier(duration);
        const timeBonus = hour !== undefined ? CoinSystem.calculateTimeOfDayBonus() : 1.0;
        const weekendBonus = isWeekend ? CoinSystem.calculateWeekendBonus() : 1.0;
        const houseBonus = houseType ? CoinSystem.getHouseCompletionBonus(houseType, isFirstOfType) : 0;
        const perfectBonus = perfectStreak ? CoinSystem.calculatePerfectSessionBonus(perfectStreak) : 0;
        
        const multipliedCoins = Math.floor(baseCoins * difficultyMultiplier * timeBonus * weekendBonus * eventMultiplier);
        const totalCoins = multipliedCoins + houseBonus + perfectBonus;
        
        return {
            baseCoins,
            difficultyMultiplier,
            timeBonus,
            weekendBonus,
            houseBonus,
            perfectBonus,
            eventMultiplier,
            totalCoins,
            breakdown: {
                'Base coins (time focused)': baseCoins,
                'Difficulty bonus': `×${difficultyMultiplier.toFixed(1)}`,
                'Time of day bonus': `×${timeBonus.toFixed(1)}`,
                'Weekend bonus': weekendBonus > 1 ? `×${weekendBonus.toFixed(1)}` : null,
                'House completion': houseBonus > 0 ? `+${houseBonus}` : null,
                'Perfect streak': perfectBonus > 0 ? `+${perfectBonus}` : null,
                'Event bonus': eventMultiplier > 1 ? `×${eventMultiplier.toFixed(1)}` : null
            }
        };
    }
};

window.CoinSystem = CoinSystem;
