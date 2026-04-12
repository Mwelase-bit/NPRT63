const { useState, useEffect, useRef, useCallback, useMemo } = React;
const useGameState = () => {
    const [gameState, setGameState] = useState({
        buildStage: 0,
        currentHouse: 'cottage',
        isBuilding: false,
        isCollapsing: false,
        completedHouses: [],
        faculty: null,
        playerName: '',
        token: null,
        user: null,
        builderCustomization: {
            gender: 'male',
            name: 'Builder',
            skinColor: '#FDBCB4',
            overallColor: '#4169E1',
            hatColor: '#FFD700',
            hairColor: '#8B4513',
            hairStyle: 'short',
            outfit: 'default',
            hat: 'hardhat',
            tool: 'hammer'
        },
        purchasedItems: {
            outfits: ['default'],
            hats: ['hardhat'],
            tools: ['hammer'],
            houses: ['skyscraper']
        }
    });

    // Load game state from storage on mount
    useEffect(() => {
        const savedState = Storage.getGameState();
        const savedToken = localStorage.getItem('buildersFocus_token');

        if (savedState) {
            setGameState(prevState => ({
                ...prevState,
                ...savedState,
                token: savedToken,
                isBuilding: false,
                isCollapsing: false
            }));
        }
    }, []);

    // Save game state to storage whenever it changes
    useEffect(() => {
        const { token, user, ...stateToSave } = gameState;
        Storage.saveGameState(stateToSave);
        if (token) {
            localStorage.setItem('buildersFocus_token', token);
        }
    }, [gameState]);

    const startBuilding = () => {
        setGameState(prev => ({
            ...prev,
            isBuilding: true,
            isCollapsing: false,
            buildStage: 1  // Start from foundation (stage 1)
        }));
    };

    const updateBuildStage = (stage) => {
        setGameState(prev => ({
            ...prev,
            buildStage: Math.min(stage, 4)
        }));
    };

    const completeBuilding = () => {
        setGameState(prev => {
            const newCompletedHouse = {
                type: prev.currentHouse,
                position: [
                    (prev.completedHouses.length % 5) * 4 - 8,
                    0,
                    Math.floor(prev.completedHouses.length / 5) * 4 - 4
                ],
                completedAt: Date.now()
            };

            return {
                ...prev,
                buildStage: 4,
                isBuilding: false,
                completedHouses: [...prev.completedHouses, newCompletedHouse],
                currentHouse: getNextHouseType(prev.completedHouses.length + 1)
            };
        });
    };

    const triggerDemolition = () => {
        setGameState(prev => ({
            ...prev,
            isCollapsing: true,
            isBuilding: false
        }));

        // Reset after demolition animation
        setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                isCollapsing: false,
                buildStage: 1  // Reset to foundation (stage 1)
            }));
        }, 3000);
    };

    const resetBuilding = () => {
        setGameState(prev => ({
            ...prev,
            buildStage: 1,  // Reset to foundation (stage 1)
            isBuilding: false,
            isCollapsing: false
        }));
    };

    const updateBuilderCustomization = (property, value) => {
        setGameState(prev => ({
            ...prev,
            builderCustomization: {
                ...prev.builderCustomization,
                [property]: value
            }
        }));
    };

    const addPurchasedItem = (category, itemId) => {
        setGameState(prev => ({
            ...prev,
            purchasedItems: {
                ...prev.purchasedItems,
                [category]: [...(prev.purchasedItems[category] || []), itemId]
            }
        }));
    };

    const unlockHouseType = (houseType) => {
        setGameState(prev => ({
            ...prev,
            purchasedItems: {
                ...prev.purchasedItems,
                houses: [...prev.purchasedItems.houses, houseType]
            }
        }));
    };

    const getNextHouseType = (houseCount) => {
        if (houseCount >= 50) return 'skyscraper';
        if (houseCount >= 20) return 'castle';
        if (houseCount >= 10) return 'mansion';
        if (houseCount >= 5) return 'lighthouse';
        return 'treehouse';
    };

    const register = async (userData) => {
        try {
            console.log('Registering user in gameState:', userData);
            const response = await window.api.auth.register(userData);

            setGameState(prev => ({
                ...prev,
                faculty: response.user.faculty,
                playerName: response.user.name,
                token: response.token,
                user: response.user,
                builderCustomization: {
                    ...prev.builderCustomization,
                    name: response.user.name
                }
            }));

            return response;
        } catch (error) {
            console.error('Registration failed in gameState:', error);
            throw error;
        }
    };

    const login = async (credentials) => {
        try {
            console.log('Logging in user...');
            const response = await window.api.auth.login(credentials);

            setGameState(prev => ({
                ...prev,
                faculty: response.user.faculty,
                playerName: response.user.name,
                token: response.token,
                user: response.user,
                builderCustomization: {
                    ...prev.builderCustomization,
                    name: response.user.name
                }
            }));

            // Sync purchased items from backend into local state
            if (response.ownedItems && response.ownedItems.length > 0) {
                // Here we would ideally categorize them properly, but for now 
                // just storing them in a general list or fetching them correctly in ShopPanel
                // We'll trust the shop to pull live data eventually
            }

            return response;
        } catch (error) {
            console.error('Login failed in gameState:', error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('buildersFocus_token');
        localStorage.removeItem('buildersFocus_gameState'); // Optional: clear game state
        setGameState(prev => ({
            ...prev,
            token: null,
            user: null,
            faculty: null,
            playerName: ''
        }));
        // Reloading the page cleanly resets all hooks
        window.location.reload();
    };

    const setFaculty = (faculty) => {
        setGameState(prev => ({ ...prev, faculty }));
    };

    const setPlayerName = (playerName) => {
        setGameState(prev => ({ ...prev, playerName }));
    };

    return {
        ...gameState,
        startBuilding,
        updateBuildStage,
        completeBuilding,
        triggerDemolition,
        resetBuilding,
        updateBuilderCustomization,
        addPurchasedItem,
        unlockHouseType,
        setFaculty,
        setPlayerName,
        register,
        login,
        logout
    };
};

window.useGameState = useGameState;
