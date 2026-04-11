const { useState, useEffect, useMemo } = React;

const SPU_FACULTIES = [
    { id: 'nas', name: 'Faculty of Natural and Applied Sciences', shortName: 'NAS', color: '#2196F3', emoji: '🔬' },
    { id: 'edu', name: 'Faculty of Education', shortName: 'Education', color: '#4CAF50', emoji: '📚' },
    { id: 'ems', name: 'Faculty of Economic and Management Sciences', shortName: 'EMS', color: '#FF9800', emoji: '📊' },
    { id: 'hum', name: 'Faculty of Humanities', shortName: 'Humanities', color: '#9C27B0', emoji: '🎨' }
];

// ── Fallback mock data when not logged in ──────────────────────────────────────
const MOCK_FACULTY_MEMBERS = {
    nas: [
        { id: 1, name: 'Kamo Sithole', weeklyHours: 24.5, streak: 18, housesBuilt: 12 },
        { id: 2, name: 'Thabo Dlamini', weeklyHours: 21.0, streak: 14, housesBuilt: 9 },
        { id: 3, name: 'Naledi Mokoena', weeklyHours: 19.5, streak: 22, housesBuilt: 15 },
        { id: 4, name: 'Sipho Nkosi', weeklyHours: 16.0, streak: 7, housesBuilt: 5 },
        { id: 5, name: 'Ayanda Zulu', weeklyHours: 14.5, streak: 10, housesBuilt: 7 },
    ],
    edu: [
        { id: 6, name: 'Lerato Molefe', weeklyHours: 22.0, streak: 25, housesBuilt: 18 },
        { id: 7, name: 'Bongani Khumalo', weeklyHours: 18.5, streak: 12, housesBuilt: 10 },
        { id: 8, name: 'Zanele Ndlovu', weeklyHours: 17.0, streak: 9, housesBuilt: 8 },
        { id: 9, name: 'Sifiso Mthembu', weeklyHours: 14.0, streak: 6, housesBuilt: 6 },
    ],
    ems: [
        { id: 10, name: 'Ongeziwe Xulu', weeklyHours: 26.0, streak: 30, housesBuilt: 22 },
        { id: 11, name: 'Thandeka Mhlongo', weeklyHours: 23.5, streak: 20, housesBuilt: 16 },
        { id: 12, name: 'Musa Architect', weeklyHours: 20.0, streak: 15, housesBuilt: 11 },
        { id: 13, name: 'Ntombi Shabalala', weeklyHours: 17.5, streak: 11, housesBuilt: 9 },
    ],
    hum: [
        { id: 14, name: 'Dineo Motsepe', weeklyHours: 20.5, streak: 16, housesBuilt: 13 },
        { id: 15, name: 'Karabo Seema', weeklyHours: 18.0, streak: 13, housesBuilt: 10 },
        { id: 16, name: 'Sindi Mahlangu', weeklyHours: 15.5, streak: 10, housesBuilt: 8 },
        { id: 17, name: 'Thulani Ntuli', weeklyHours: 12.5, streak: 7, housesBuilt: 5 },
    ]
};

const useFaculty = (gameState, rewards) => {
    const userFaculty = gameState.faculty;
    const isLoggedIn = !!gameState.token;

    // ── Live leaderboard state (populated from backend) ──────────────────────
    const [liveLeaderboard, setLiveLeaderboard] = useState(null); // faculty
    const [liveInterfaculty, setLiveInterfaculty] = useState(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    // Fetch live data whenever the user logs in or their faculty changes
    useEffect(() => {
        if (!isLoggedIn || !userFaculty) return;

        let cancelled = false;
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

        return () => { cancelled = true; };
    }, [isLoggedIn, userFaculty, rewards.housesBuilt]); // re-fetch when a house is built

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
        const members = [...(MOCK_FACULTY_MEMBERS[userFaculty] || []), userEntry];
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
        // Fall back to summed mock data
        return SPU_FACULTIES.map(faculty => {
            const members = MOCK_FACULTY_MEMBERS[faculty.id] || [];
            const totalHours = members.reduce((s, m) => s + m.weeklyHours, 0) +
                (faculty.id === userFaculty ? (userEntry.weeklyHours || 0) : 0);
            return {
                ...faculty,
                totalHours: parseFloat(totalHours.toFixed(1)),
                memberCount: members.length + (faculty.id === userFaculty ? 1 : 0)
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
        isLiveData: liveLeaderboard !== null
    };
};

window.useFaculty = useFaculty;
window.SPU_FACULTIES = SPU_FACULTIES;
