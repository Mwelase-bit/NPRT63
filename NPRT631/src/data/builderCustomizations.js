const BUILDER_CUSTOMIZATIONS = {
    genders: {
        male: {
            name: 'Male Builder',
            defaultSkinColor: '#FDBCB4',
            defaultHairColor: '#8B4513',
            animations: {
                idle: 'male_idle',
                building: 'male_building',
                celebrating: 'male_celebrate',
                frustrated: 'male_frustrated'
            }
        },
        female: {
            name: 'Female Builder',
            defaultSkinColor: '#FDBCB4',
            defaultHairColor: '#8B4513',
            animations: {
                idle: 'female_idle',
                building: 'female_building',
                celebrating: 'female_celebrate',
                frustrated: 'female_frustrated'
            },
            hairStyles: ['short', 'ponytail', 'bun']
        }
    },
    
    skinColors: [
        { name: 'Light', color: '#FDBCB4' },
        { name: 'Medium Light', color: '#F1C27D' },
        { name: 'Medium', color: '#E0AC69' },
        { name: 'Medium Dark', color: '#C68642' },
        { name: 'Dark', color: '#8D5524' }
    ],
    
    overallColors: [
        { name: 'Classic Blue', color: '#4169E1', unlocked: true },
        { name: 'Safety Orange', color: '#FF8C00', unlocked: true },
        { name: 'Forest Green', color: '#32CD32', unlocked: true },
        { name: 'Hot Pink', color: '#FF69B4', price: 50 },
        { name: 'Purple', color: '#9370DB', price: 50 },
        { name: 'Crimson', color: '#DC143C', price: 75 },
        { name: 'Navy Blue', color: '#000080', price: 100 }
    ],
    
    hatColors: [
        { name: 'Classic Yellow', color: '#FFD700', unlocked: true },
        { name: 'Safety Orange', color: '#FF4500', unlocked: true },
        { name: 'Bright Cyan', color: '#00CED1', price: 25 },
        { name: 'Hot Pink', color: '#FF1493', price: 25 },
        { name: 'Lime Green', color: '#7FFF00', price: 25 },
        { name: 'White', color: '#FFFFFF', price: 50 },
        { name: 'Black', color: '#000000', price: 75 }
    ],
    
    hairColors: [
        { name: 'Brown', color: '#8B4513', unlocked: true },
        { name: 'Blonde', color: '#FFD700', unlocked: true },
        { name: 'Black', color: '#000000', unlocked: true },
        { name: 'Auburn', color: '#A52A2A', price: 30 },
        { name: 'Red', color: '#FF0000', price: 30 },
        { name: 'Silver', color: '#C0C0C0', price: 50 }
    ],
    
    outfits: {
        default: {
            name: 'Classic Overalls',
            description: 'The timeless builder look',
            unlocked: true,
            parts: {
                body: 'overalls',
                accessories: ['tool_belt']
            }
        },
        professional: {
            name: 'Professional Suit',
            description: 'For the sophisticated builder',
            price: 100,
            requirements: { housesBuilt: 5 },
            parts: {
                body: 'suit',
                accessories: ['tie', 'tool_belt']
            }
        },
        casual: {
            name: 'Casual Wear',
            description: 'Comfortable building attire',
            price: 50,
            parts: {
                body: 'casual_shirt',
                accessories: ['tool_belt']
            }
        },
        superhero: {
            name: 'Super Builder',
            description: 'For the legendary builders',
            price: 500,
            requirements: { streak: 30 },
            parts: {
                body: 'superhero_suit',
                accessories: ['cape', 'tool_belt']
            },
            effects: ['building_speed_boost']
        },
        winter: {
            name: 'Winter Gear',
            description: 'Stay warm while building',
            price: 150,
            seasonal: 'winter',
            parts: {
                body: 'winter_coat',
                accessories: ['scarf', 'tool_belt']
            }
        }
    },
    
    hats: {
        hardhat: {
            name: 'Hard Hat',
            description: 'Safety first!',
            unlocked: true,
            safety: true
        },
        cowboy: {
            name: 'Cowboy Hat',
            description: 'Yeehaw! Build em up partner!',
            price: 75,
            requirements: { housesBuilt: 3 }
        },
        crown: {
            name: 'Builder Crown',
            description: 'For the master builder',
            price: 300,
            requirements: { streak: 14 },
            effects: ['coin_bonus']
        },
        viking: {
            name: 'Viking Helmet',
            description: 'Conquer your focus goals!',
            price: 150,
            requirements: { housesBuilt: 20 }
        },
        chef: {
            name: 'Chef Hat',
            description: 'Cooking up some focus!',
            price: 100,
            special: true
        },
        baseball: {
            name: 'Baseball Cap',
            description: 'Casual building vibes',
            price: 40
        },
        beret: {
            name: 'Artist Beret',
            description: 'For the creative builder',
            price: 60,
            requirements: { completedAchievements: 10 }
        }
    },
    
    tools: {
        hammer: {
            name: 'Classic Hammer',
            description: 'The trusty builder tool',
            unlocked: true,
            buildSpeed: 1.0
        },
        golden_hammer: {
            name: 'Golden Hammer',
            description: 'A prestigious building tool',
            price: 200,
            requirements: { coins: 100 },
            buildSpeed: 1.1,
            effects: ['coin_bonus_10']
        },
        power_drill: {
            name: 'Power Drill',
            description: 'Modern building efficiency',
            price: 150,
            requirements: { housesBuilt: 10 },
            buildSpeed: 1.5,
            effects: ['visual_speed_boost']
        },
        wrench: {
            name: 'Multi-Tool Wrench',
            description: 'Versatile and reliable',
            price: 80,
            buildSpeed: 1.2
        },
        saw: {
            name: 'Electric Saw',
            description: 'Cut through distractions',
            price: 120,
            buildSpeed: 1.3,
            effects: ['focus_enhancement']
        },
        blueprint: {
            name: 'Magic Blueprint',
            description: 'Prevents house demolition once per day',
            price: 1000,
            requirements: { totalFocusTime: 36000 },
            special: true,
            effects: ['demolition_protection']
        }
    },
    
    accessories: {
        glasses: {
            name: 'Safety Glasses',
            description: 'Protect your vision',
            price: 30,
            category: 'face'
        },
        sunglasses: {
            name: 'Cool Sunglasses',
            description: 'Look cool while building',
            price: 50,
            category: 'face',
            effects: ['style_bonus']
        },
        mustache: {
            name: 'Handlebar Mustache',
            description: 'Distinguished builder look',
            price: 25,
            category: 'face',
            gender: 'male'
        },
        earrings: {
            name: 'Builder Earrings',
            description: 'Stylish work accessories',
            price: 40,
            category: 'face',
            gender: 'female'
        },
        watch: {
            name: 'Builder Watch',
            description: 'Keep track of focus time',
            price: 75,
            category: 'wrist',
            effects: ['time_tracking']
        },
        gloves: {
            name: 'Work Gloves',
            description: 'Better grip on tools',
            price: 35,
            category: 'hands',
            effects: ['grip_bonus']
        },
        boots: {
            name: 'Steel-Toe Boots',
            description: 'Safety and style combined',
            price: 90,
            category: 'feet',
            effects: ['safety_bonus']
        }
    },
    
    // Unlock conditions
    checkUnlockConditions: (item, playerStats) => {
        if (!item.requirements) return true;
        
        const { requirements } = item;
        
        if (requirements.housesBuilt && playerStats.housesBuilt < requirements.housesBuilt) {
            return false;
        }
        
        if (requirements.streak && playerStats.streak < requirements.streak) {
            return false;
        }
        
        if (requirements.coins && playerStats.totalCoinsEarned < requirements.coins) {
            return false;
        }
        
        if (requirements.totalFocusTime && playerStats.totalFocusTime < requirements.totalFocusTime) {
            return false;
        }
        
        if (requirements.completedAchievements && playerStats.completedAchievements < requirements.completedAchievements) {
            return false;
        }
        
        return true;
    },
    
    // Get default customization for new players
    getDefaultCustomization: (gender = 'male') => {
        const genderData = BUILDER_CUSTOMIZATIONS.genders[gender];
        
        return {
            gender: gender,
            name: 'Builder',
            skinColor: genderData.defaultSkinColor,
            hairColor: genderData.defaultHairColor,
            overallColor: '#4169E1', // Classic blue
            hatColor: '#FFD700',     // Classic yellow
            outfit: 'default',
            hat: 'hardhat',
            tool: 'hammer',
            hairStyle: gender === 'female' ? 'ponytail' : 'short',
            accessories: []
        };
    }
};

window.BUILDER_CUSTOMIZATIONS = BUILDER_CUSTOMIZATIONS;
