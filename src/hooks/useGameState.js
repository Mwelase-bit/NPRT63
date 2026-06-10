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
        authRestoring: true,  // true while we check a saved token on startup
        backendOffline: false, // true if backend is unreachable
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

    // ── On mount: attempt to restore session from a saved JWT ───────────────
    // This is what keeps you logged in after closing the laptop.
    // If the token is still valid, /api/auth/me returns your full profile
    // and we silently restore the session — no login screen needed.
    useEffect(() => {
        const savedToken = localStorage.getItem('buildersFocus_token');
        const savedState = Storage.getGameState();

        if (!savedToken) {
            // No token at all — go straight to registration
            setGameState(prev => ({ ...prev, authRestoring: false }));
            return;
        }

        // Restore any persisted game state (customisations, houses, etc.)
        if (savedState) {
            setGameState(prev => ({
                ...prev,
                ...savedState,
                token: savedToken,
                isBuilding: false,
                isCollapsing: false
            }));
        }

        // Try to re-validate the token with the backend
        window.api.auth.getMe()
            .then(data => {
                // Token is valid — restore full user session from backend
                const user = data.user;
                setGameState(prev => ({
                    ...prev,
                    token: savedToken,
                    user: user,
                    faculty: user.faculty,
                    playerName: user.name,
                    authRestoring: false,
                    backendOffline: false,
                    builderCustomization: {
                        ...prev.builderCustomization,
                        name: user.name,
                        gender: user.gender || prev.builderCustomization.gender
                    }
                }));
                console.log('✅ Session restored for:', user.name);
            })
            .catch(err => {
                if (err.status === 401 || err.status === 404) {
                    // Token is expired or user no longer exists — clear it
                    console.warn('Saved token is invalid, clearing session.');
                    localStorage.removeItem('buildersFocus_token');
                    setGameState(prev => ({
                        ...prev,
                        token: null,
                        user: null,
                        faculty: null,
                        playerName: '',
                        authRestoring: false,
                        backendOffline: false
                    }));
                } else {
                    // Network error — backend is offline.
                    // Keep the token and local state so the user can continue
                    // once the server is back up, but show an offline warning.
                    console.warn('Backend unreachable — running in offline mode.');
                    setGameState(prev => ({
                        ...prev,
                        token: savedToken,
                        authRestoring: false,
                        backendOffline: true
                    }));
                }
            });
    }, []); // runs once on mount

    // Save game state to storage whenever it changes
    useEffect(() => {
        const { token, user, authRestoring, backendOffline, ...stateToSave } = gameState;
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
        // Disabled: the house no longer collapses during a session.
        // Session ends only via Stop button or natural timer completion.
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
    // Note: authRestoring and backendOffline are spread from ...gameState above
};

window.useGameState = useGameState;
