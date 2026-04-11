const ACHIEVEMENTS = [
    // Focus Achievements
    {
        id: 'first_focus',
        name: 'First Steps',
        description: 'Complete your first focus session',
        icon: 'play-circle',
        category: 'focus',
        rarity: 'common',
        coinReward: 50,
        progress: { type: 'sessions', target: 1 }
    },
    {
        id: 'focused_mind',
        name: 'Focused Mind',
        description: 'Complete 10 focus sessions',
        icon: 'target',
        category: 'focus',
        rarity: 'uncommon',
        coinReward: 100,
        progress: { type: 'sessions', target: 10 }
    },
    {
        id: 'focus_master',
        name: 'Focus Master',
        description: 'Complete 100 focus sessions',
        icon: 'award',
        category: 'focus',
        rarity: 'rare',
        coinReward: 500,
        progress: { type: 'sessions', target: 100 }
    },
    {
        id: 'marathon_focus',
        name: 'Marathon Builder',
        description: 'Focus for a total of 10 hours',
        icon: 'clock',
        category: 'focus',
        rarity: 'epic',
        coinReward: 1000,
        progress: { type: 'time', target: 36000 }
    },
    
    // Building Achievements
    {
        id: 'first_house',
        name: 'Homeowner',
        description: 'Build your first house',
        icon: 'home',
        category: 'building',
        rarity: 'common',
        coinReward: 75,
        progress: { type: 'houses', target: 1 }
    },
    {
        id: 'neighborhood',
        name: 'Neighborhood Developer',
        description: 'Build 10 houses',
        icon: 'map',
        category: 'building',
        rarity: 'uncommon',
        coinReward: 200,
        progress: { type: 'houses', target: 10 }
    },
    {
        id: 'city_builder',
        name: 'City Builder',
        description: 'Build 50 houses',
        icon: 'grid',
        category: 'building',
        rarity: 'rare',
        coinReward: 750,
        progress: { type: 'houses', target: 50 }
    },
    {
        id: 'metropolis',
        name: 'Metropolis Architect',
        description: 'Build 100 houses',
        icon: 'layers',
        category: 'building',
        rarity: 'legendary',
        coinReward: 2000,
        progress: { type: 'houses', target: 100 }
    },
    
    // Streak Achievements
    {
        id: 'streak_start',
        name: 'Getting Started',
        description: 'Maintain a 3-day focus streak',
        icon: 'zap',
        category: 'streak',
        rarity: 'common',
        coinReward: 100,
        progress: { type: 'streak', target: 3 }
    },
    {
        id: 'week_warrior',
        name: 'Week Warrior',
        description: 'Maintain a 7-day focus streak',
        icon: 'calendar',
        category: 'streak',
        rarity: 'uncommon',
        coinReward: 250,
        progress: { type: 'streak', target: 7 }
    },
    {
        id: 'data_master',
        name: 'Data Master',
        description: 'Maintain a 20-day focus streak',
        icon: 'trending-up',
        category: 'streak',
        rarity: 'epic',
        coinReward: 1000,
        specialReward: '1GB Data',
        progress: { type: 'streak', target: 20 }
    },
    {
        id: 'data_champion',
        name: 'Data Champion',
        description: 'Maintain a 50-day focus streak',
        icon: 'star',
        category: 'streak',
        rarity: 'legendary',
        coinReward: 5000,
        specialReward: '5GB Data + Golden Builder Crown',
        progress: { type: 'streak', target: 50 }
    },
    
    // Milestone Achievements
    {
        id: 'coin_collector',
        name: 'Coin Collector',
        description: 'Earn 1000 coins',
        icon: 'dollar-sign',
        category: 'milestone',
        rarity: 'uncommon',
        coinReward: 100,
        progress: { type: 'coins', target: 1000 }
    },
    {
        id: 'wealthy_builder',
        name: 'Wealthy Builder',
        description: 'Earn 10000 coins',
        icon: 'briefcase',
        category: 'milestone',
        rarity: 'rare',
        coinReward: 500,
        progress: { type: 'coins', target: 10000 }
    },
    {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: 'Complete 20 sessions without interruption',
        icon: 'check-circle',
        category: 'milestone',
        rarity: 'rare',
        coinReward: 400,
        progress: { type: 'perfect_sessions', target: 20 }
    },
    {
        id: 'speed_builder',
        name: 'Speed Builder',
        description: 'Complete a 1-hour focus session',
        icon: 'fast-forward',
        category: 'milestone',
        rarity: 'uncommon',
        coinReward: 200,
        progress: { type: 'long_session', target: 3600 }
    },
    {
        id: 'endurance_master',
        name: 'Endurance Master',
        description: 'Complete a 4-hour focus session',
        icon: 'battery',
        category: 'milestone',
        rarity: 'epic',
        coinReward: 1000,
        specialReward: 'Endurance Badge',
        progress: { type: 'long_session', target: 14400 }
    },
    
    // Secret Achievements
    {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Complete a focus session before 6 AM',
        icon: 'sunrise',
        category: 'milestone',
        rarity: 'rare',
        coinReward: 300,
        progress: { type: 'early_session', target: 1 }
    },
    {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Complete a focus session after 10 PM',
        icon: 'moon',
        category: 'milestone',
        rarity: 'rare',
        coinReward: 300,
        progress: { type: 'late_session', target: 1 }
    },
    {
        id: 'weekend_warrior',
        name: 'Weekend Warrior',
        description: 'Complete 10 weekend focus sessions',
        icon: 'coffee',
        category: 'milestone',
        rarity: 'uncommon',
        coinReward: 200,
        progress: { type: 'weekend_sessions', target: 10 }
    }
];

window.ACHIEVEMENTS = ACHIEVEMENTS;
