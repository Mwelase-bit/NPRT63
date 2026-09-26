const HOUSE_TYPES = {
    cottage: {
        name: 'Cottage',
        description: 'A cozy starter home',
        difficulty: 'easy',
        buildTime: 25 * 60, // 25 minutes
        coinReward: 25,
        unlockLevel: 0,
        foundation: {
            width: 3,
            depth: 3
        },
        walls: {
            width: 3,
            height: 2,
            depth: 3
        },
        roof: {
            width: 3.5,
            depth: 3.5,
            angle: 0.3
        },
        colors: {
            walls: '#E6B89C',
            roof: '#B22222',
            door: '#8B4513',
            foundation: '#808080'
        },
        stages: [
            {
                name: 'Empty Lot',
                description: 'Clear land ready for construction',
                progress: 0
            },
            {
                name: 'Foundation',
                description: 'Strong concrete foundation laid',
                progress: 25
            },
            {
                name: 'Walls & Structure',
                description: 'Walls, doors, and windows installed',
                progress: 60
            },
            {
                name: 'Roof & Exterior',
                description: 'Roof completed and exterior finished',
                progress: 85
            },
            {
                name: 'Finishing Touches',
                description: 'Final details and landscaping',
                progress: 100
            }
        ]
    },
    
    townhouse: {
        name: 'Townhouse',
        description: 'A multi-story urban home',
        difficulty: 'medium',
        buildTime: 45 * 60, // 45 minutes
        coinReward: 50,
        unlockLevel: 10,
        foundation: {
            width: 4,
            depth: 3.5
        },
        walls: {
            width: 4,
            height: 3,
            depth: 3.5
        },
        roof: {
            width: 4.5,
            depth: 4,
            angle: 0.25
        },
        colors: {
            walls: '#D2B48C',
            roof: '#8B4513',
            door: '#654321',
            foundation: '#696969'
        },
        stages: [
            {
                name: 'Site Preparation',
                description: 'Urban lot prepared for construction',
                progress: 0
            },
            {
                name: 'Foundation & Basement',
                description: 'Deep foundation with basement area',
                progress: 20
            },
            {
                name: 'First Floor Structure',
                description: 'Ground floor walls and framework',
                progress: 45
            },
            {
                name: 'Second Floor & Roof',
                description: 'Upper floor and roofing system',
                progress: 75
            },
            {
                name: 'Interior & Exterior',
                description: 'Complete interior and exterior finishing',
                progress: 100
            }
        ],
        features: ['balcony', 'garage', 'garden']
    },
    
    mansion: {
        name: 'Mansion',
        description: 'A luxurious estate home',
        difficulty: 'hard',
        buildTime: 2 * 60 * 60, // 2 hours
        coinReward: 100,
        unlockLevel: 25,
        foundation: {
            width: 6,
            depth: 5
        },
        walls: {
            width: 6,
            height: 4,
            depth: 5
        },
        roof: {
            width: 7,
            depth: 6,
            angle: 0.2
        },
        colors: {
            walls: '#F5F5DC',
            roof: '#2F4F4F',
            door: '#8B0000',
            foundation: '#2F4F4F'
        },
        stages: [
            {
                name: 'Estate Planning',
                description: 'Large estate lot surveyed and planned',
                progress: 0
            },
            {
                name: 'Foundation Complex',
                description: 'Extensive foundation with multiple levels',
                progress: 15
            },
            {
                name: 'Main Structure',
                description: 'Primary building framework completed',
                progress: 40
            },
            {
                name: 'Wings & Extensions',
                description: 'Side wings and additional structures',
                progress: 65
            },
            {
                name: 'Luxury Finishing',
                description: 'High-end materials and landscaping',
                progress: 100
            }
        ],
        features: ['pool', 'tennis_court', 'wine_cellar', 'library', 'ballroom']
    },
    
    castle: {
        name: 'Grand Castle Estate',
        description: 'A magnificent castle with elegant estate grounds',
        difficulty: 'expert',
        buildTime: 3 * 60 * 60, // 3 hours
        coinReward: 200,
        unlockLevel: 50,
        foundation: {
            width: 8,
            depth: 8
        },
        walls: {
            width: 8,
            height: 6,
            depth: 8
        },
        roof: {
            width: 9,
            depth: 9,
            angle: 0.15
        },
        colors: {
            walls: '#708090',
            roof: '#2F4F4F',
            door: '#8B4513',
            foundation: '#2F4F4F'
        },
        stages: [
            {
                name: 'Estate Grounds',
                description: 'Beautiful estate grounds with hedge fences prepared',
                progress: 0
            },
            {
                name: 'Castle Foundation',
                description: 'Massive stone foundation and estate pathways',
                progress: 20
            },
            {
                name: 'Outer Walls & Gates',
                description: 'Defensive walls and elegant gatehouse entrance',
                progress: 45
            },
            {
                name: 'Towers & Keep',
                description: 'Corner towers and central keep with bird fountain',
                progress: 75
            },
            {
                name: 'Estate Finishing',
                description: 'Garden beds, benches, and castle flags raised',
                progress: 100
            }
        ],
        features: ['hedge_fence', 'bird_fountain', 'garden_beds', 'stone_pathways', 'decorative_benches', 'castle_flags']
    },
    
    estate: {
        name: 'Luxury Estate',
        description: 'An elegant estate with mansion and beautiful grounds',
        difficulty: 'legendary',
        buildTime: 4 * 60 * 60, // 4 hours
        coinReward: 500,
        unlockLevel: 100,
        foundation: {
            width: 10,
            depth: 10
        },
        walls: {
            width: 10,
            height: 5,
            depth: 10
        },
        roof: {
            width: 11,
            depth: 11,
            angle: 0.1
        },
        colors: {
            walls: '#F5F5DC',
            roof: '#8B4513',
            door: '#654321',
            foundation: '#2F4F4F'
        },
        stages: [
            {
                name: 'Estate Planning',
                description: 'Grand estate grounds surveyed and planned',
                progress: 0
            },
            {
                name: 'Foundation & Landscaping',
                description: 'Estate foundation with hedge maze and gardens',
                progress: 15
            },
            {
                name: 'Mansion Structure',
                description: 'Main mansion building with multiple wings',
                progress: 40
            },
            {
                name: 'Estate Features',
                description: 'Fountains, gazebos, and decorative elements',
                progress: 70
            },
            {
                name: 'Luxury Finishing',
                description: 'Final estate touches and royal gardens',
                progress: 100
            }
        ],
        features: ['hedge_maze', 'multiple_fountains', 'gazebos', 'rose_gardens', 'tennis_court', 'swimming_pool']
    }
};

// House progression system
const HouseProgression = {
    getHouseForLevel: (housesBuilt) => {
        if (housesBuilt >= 100) return 'estate';
        if (housesBuilt >= 50) return 'castle';
        if (housesBuilt >= 25) return 'mansion';
        if (housesBuilt >= 10) return 'townhouse';
        return 'cottage';
    },
    
    getNextHouse: (currentHouse) => {
        const progression = ['cottage', 'townhouse', 'mansion', 'castle', 'estate'];
        const currentIndex = progression.indexOf(currentHouse);
        return progression[currentIndex + 1] || 'estate';
    },
    
    getHouseVariant: (houseType, variant = 'default') => {
        const variants = {
            cottage: {
                default: HOUSE_TYPES.cottage,
                modern: {
                    ...HOUSE_TYPES.cottage,
                    colors: {
                        walls: '#F0F8FF',
                        roof: '#4169E1',
                        door: '#000080',
                        foundation: '#708090'
                    }
                },
                rustic: {
                    ...HOUSE_TYPES.cottage,
                    colors: {
                        walls: '#DEB887',
                        roof: '#8B4513',
                        door: '#654321',
                        foundation: '#696969'
                    }
                }
            },
            townhouse: {
                default: HOUSE_TYPES.townhouse,
                victorian: {
                    ...HOUSE_TYPES.townhouse,
                    colors: {
                        walls: '#E6E6FA',
                        roof: '#800080',
                        door: '#4B0082',
                        foundation: '#2F4F4F'
                    }
                }
            }
        };
        
        return variants[houseType]?.[variant] || HOUSE_TYPES[houseType];
    },
    
    calculateBuildStage: (timeElapsed, totalTime) => {
        const progress = Math.min(timeElapsed / totalTime, 1);
        
        if (progress < 0.25) return 1; // Foundation
        if (progress < 0.6) return 2;  // Walls
        if (progress < 0.85) return 3; // Roof
        return 4; // Finished
    },
    
    getStageDescription: (houseType, stage) => {
        const house = HOUSE_TYPES[houseType];
        if (house && house.stages && house.stages[stage]) {
            return house.stages[stage];
        }
        
        const defaultStages = [
            { name: 'Empty Lot', description: 'Ready for construction' },
            { name: 'Foundation', description: 'Foundation completed' },
            { name: 'Structure', description: 'Walls and framework done' },
            { name: 'Roof', description: 'Roof and exterior complete' },
            { name: 'Finished', description: 'Construction complete!' }
        ];
        
        return defaultStages[stage] || defaultStages[0];
    },
    
    getCompletionReward: (houseType, isFirstOfType = false) => {
        const house = HOUSE_TYPES[houseType];
        const baseReward = house ? house.coinReward : 25;
        
        // Double reward for first house of each type
        const multiplier = isFirstOfType ? 2 : 1;
        
        return baseReward * multiplier;
    },
    
    isHouseUnlocked: (houseType, playerLevel) => {
        const house = HOUSE_TYPES[houseType];
        return house && playerLevel >= house.unlockLevel;
    }
};

// Village expansion system
const VillageSystem = {
    calculateVillageLevel: (housesBuilt) => {
        return Math.floor(housesBuilt / 5) + 1;
    },
    
    getVillageSize: (level) => {
        return Math.min(level * 2, 20); // Max 20x20 village
    },
    
    generateHousePosition: (houseIndex, villageLevel) => {
        const gridSize = Math.min(villageLevel + 2, 10);
        const spacing = 5;
        
        const x = (houseIndex % gridSize) * spacing - (gridSize * spacing / 2);
        const z = Math.floor(houseIndex / gridSize) * spacing - (gridSize * spacing / 2);
        
        return [x, 0, z];
    },
    
    getVillageFeatures: (level) => {
        const features = [];
        
        if (level >= 2) features.push('park');
        if (level >= 3) features.push('fountain');
        if (level >= 5) features.push('market');
        if (level >= 8) features.push('school');
        if (level >= 10) features.push('library');
        if (level >= 15) features.push('museum');
        if (level >= 20) features.push('cathedral');
        
        return features;
    }
};

window.HOUSE_TYPES = HOUSE_TYPES;
window.HouseProgression = HouseProgression;
window.VillageSystem = VillageSystem;
