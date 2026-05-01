const { useState, useEffect, useMemo } = React;

const SPU_FACULTIES = [
    { id: 'nas', name: 'Faculty of Natural and Applied Sciences', shortName: 'NAS', color: '#2196F3', emoji: '🔬' },
    { id: 'edu', name: 'Faculty of Education', shortName: 'Education', color: '#4CAF50', emoji: '📚' },
    { id: 'ems', name: 'Faculty of Economic and Management Sciences', shortName: 'EMS', color: '#FF9800', emoji: '📊' },
    { id: 'hum', name: 'Faculty of Humanities', shortName: 'Humanities', color: '#9C27B0', emoji: '🎨' }
];

const useFaculty = (gameState, rewards) => {
    const userFaculty = gameState.faculty;
    const isLoggedIn = !!gameState.token;

    // ── Live leaderboard state (populated from backend) ──────────────────────
    const [liveLeaderboard, setLiveLeaderboard] = useState(null); // faculty
    const [liveInterfaculty, setLiveInterfaculty] = useState(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    const refreshRef = React.useRef();

    // Fetch live data whenever the user logs in or their faculty changes
    useEffect(() => {
        if (!isLoggedIn || !userFaculty) return;

        let cancelled = false;

        const fetchLeaderboards = () => {
            setLoadingLeaderboard(true);
            Promise.all([
                window.api.leaderboard.getFaculty(),
                window.api.leaderboard.getInterfaculty()
            ])
                .then(([facultyRes, interfacultyRes]) => {
                    if (cancelled) return;
                    setLiveLeaderboard(facultyRes.leaderboard || []);
                    setLiveInterfaculty(interfacultyRes.rankings || []);
                })
                .catch(err => {
                    console.warn('Leaderboard fetch failed, using mocks:', err.message);
                })
                .finally(() => {
                    if (!cancelled) setLoadingLeaderboard(false);
                });
        };

        fetchLeaderboards();

        // Attach refresh function to ref so it can be called externally without triggering effect loop
        refreshRef.current = fetchLeaderboards;

        return () => { cancelled = true; };
    }, [isLoggedIn, userFaculty, rewards.housesBuilt]); // re-fetch when a house is built

    const refreshLeaderboards = React.useCallback(() => {
        if (refreshRef.current) refreshRef.current();
    }, []);


    // ── User's own entry (for injecting into mock leaderboard) ───────────────
    const userEntry = useMemo(() => ({
        id: 0,
        name: gameState.playerName || gameState.builderCustomization?.name || 'You',
        weeklyHours: parseFloat(((rewards.weeklyStats?.timeThisWeek || 0) / 3600).toFixed(1)),
        streak: rewards.streak || 0,
        housesBuilt: rewards.housesBuilt || 0,
        isCurrentUser: true
    }), [gameState.playerName, rewards.weeklyStats?.timeThisWeek, rewards.streak, rewards.housesBuilt]);

    // ── Faculty leaderboard ──────────────────────────────────────────────────
    const facultyLeaderboard = useMemo(() => {
        if (liveLeaderboard !== null) return liveLeaderboard; // Real backend data
        if (!userFaculty) return [];
        const members = [userEntry];
        return members.sort((a, b) => b.weeklyHours - a.weeklyHours);
    }, [liveLeaderboard, userFaculty, userEntry]);

    // ── Interfaculty rankings ────────────────────────────────────────────────
    const interfacultyRankings = useMemo(() => {
        if (liveInterfaculty !== null) {
            // Merge faculty colour/emoji metadata from SPU_FACULTIES
            return liveInterfaculty.map(r => ({
                ...r,
                ...SPU_FACULTIES.find(f => f.id === r.faculty)
            }));
        }
        // Fall back to current user's data while loading
        return SPU_FACULTIES.map(faculty => {
            const totalHours = (faculty.id === userFaculty ? (userEntry.weeklyHours || 0) : 0);
            return {
                ...faculty,
                totalHours: parseFloat(totalHours.toFixed(1)),
                memberCount: (faculty.id === userFaculty ? 1 : 0)
            };
        }).sort((a, b) => b.totalHours - a.totalHours);
    }, [liveInterfaculty, userFaculty, userEntry.weeklyHours]);

    const userFacultyInfo = SPU_FACULTIES.find(f => f.id === userFaculty) || null;

    return {
        SPU_FACULTIES,
        facultyLeaderboard,
        interfacultyRankings,
        userFacultyInfo,
        loadingLeaderboard,
        isLiveData: liveLeaderboard !== null,
        refreshLeaderboards
    };
};

window.useFaculty = useFaculty;
window.SPU_FACULTIES = SPU_FACULTIES;
