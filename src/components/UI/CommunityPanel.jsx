const { useState, useEffect, useRef, useCallback, useMemo } = React;
const CommunityPanel = ({ gameState, rewards, faculty }) => {
    const [activeTab, setActiveTab] = useState('global');
    const [globalStats, setGlobalStats] = useState({ totalMembers: 0, totalHours: 0, totalHouses: 0, averageStreak: 0 });
    const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    // Trigger feather icons
    useEffect(() => {
        setTimeout(() => { if (window.feather) feather.replace(); }, 50);
    });

    useEffect(() => {
        const loadCommunityData = async () => {
            try {
                if (!gameState?.token) return;
                const [summaryRes, globalRes] = await Promise.all([
                    window.api.leaderboard.getSummary(),
                    window.api.leaderboard.getGlobal()
                ]);
                setGlobalStats(summaryRes);
                setGlobalLeaderboard(globalRes.leaderboard);
            } catch (err) {
                console.error("Failed to load community data", err);
            } finally {
                setLoading(false);
            }
        };
        loadCommunityData();
    }, [gameState?.token]);

    const getStreakColor = (streak) => {
        if (streak >= 30) return "#FF6B35";
        if (streak >= 15) return "#4CAF50";
        if (streak >= 7) return "#2196F3";
        return "#9E9E9E";
    };

    const getRankEmoji = (index) => ["🥇", "🥈", "🥉"][index] || `#${index + 1}`;

    const tabs = [
        { id: 'global', label: 'Global', icon: 'globe' },
        { id: 'faculty', label: 'My Faculty', icon: 'users' },
        { id: 'interfaculty', label: 'Campus', icon: 'award' }
    ];

    return (
        <div className="community-panel">
            <h2>Community</h2>

            {/* Community Stats */}
            <div className="community-stats">
                {[
                    { icon: 'users', value: globalStats.totalMembers, label: 'Total Members' },
                    { icon: 'clock', value: `${globalStats.totalHours} hrs`, label: 'Total Study Time' },
                    { icon: 'home', value: globalStats.totalHouses, label: 'Houses Built' },
                    { icon: 'zap', value: globalStats.averageStreak, label: 'Avg. Streak' }
                ].map((s, i) => (
                    <div key={i} className="stat-card">
                        <div className="stat-icon"><i data-feather={s.icon}></i></div>
                        <div className="stat-info"><h3>{s.value}</h3><p>{s.label}</p></div>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '10px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #4CAF50' : '2px solid transparent',
                            color: activeTab === tab.id ? '#4CAF50' : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            fontSize: '0.9em',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <i data-feather={tab.icon} style={{ width: '14px', height: '14px' }}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── GLOBAL TAB ── */}
            {activeTab === 'global' && (
                <div className="friends-section">
                    <div className="friends-list">
                        {loading ? <p style={{ textAlign: 'center', opacity: 0.6 }}>Loading Global Players...</p> : globalLeaderboard.slice(0, 10).map((player, index) => (
                            <div key={player.id} className="friend-card" style={player.isCurrentUser ? { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)' } : {}}>
                                <div className="friend-avatar">
                                    <span className="avatar-emoji">{['👷', '👩‍💼', '👨‍🔧', '👩‍🎨', '👨‍🎓', '👩‍💻'][player.id % 6]}</span>
                                    <div className="level-badge" style={{ backgroundColor: '#CD7F32' }}>{player.rank}</div>
                                </div>
                                <div className="friend-info">
                                    <div className="friend-header">
                                        <h4>{player.name} {player.isCurrentUser && " (You)"}</h4>
                                        <span className="status online">{player.facultyName}</span>
                                    </div>
                                    <div className="friend-stats">
                                        <div className="stat-item"><i data-feather="clock"></i><span>Focus: {player.totalHours} hrs</span></div>
                                        <div className="stat-item"><i data-feather="home"></i><span>Houses: {player.housesBuilt}</span></div>
                                        <div className="stat-item">
                                            <i data-feather="zap"></i>
                                            <span className="streak" style={{ color: getStreakColor(player.streak) }}>{player.streak} day streak</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Top 5 Leaderboard */}
                    <div className="leaderboard" style={{ marginTop: '24px' }}>
                        <h3>Global Top 5</h3>
                        <div className="leaderboard-list">
                            {loading ? null : globalLeaderboard.slice(0, 5).map((player, index) => (
                                <div key={player.id} className="leaderboard-item" style={player.isCurrentUser ? { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)' } : {}}>
                                    <div className="rank">{getRankEmoji(index)}</div>
                                    <div className="player-info">
                                        <span className="player-name">{player.name} {player.isCurrentUser && "(You)"}</span>
                                    </div>
                                    <div className="player-score"><span>{player.totalHours} hrs</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── FACULTY TAB ── */}
            {activeTab === 'faculty' && (
                <div className="faculty-section">
                    {!gameState.faculty ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.6 }}>
                            <i data-feather="users" style={{ width: '48px', height: '48px', marginBottom: '16px' }}></i>
                            <p>You haven't joined a faculty yet. Update your profile to join a faculty and compete locally!</p>
                        </div>
                    ) : (
                        <>
                            <div className="faculty-header" style={{
                                background: `linear-gradient(135deg, ${faculty?.userFacultyInfo?.color || '#2c3e50'}, #1a252f)`,
                                padding: '20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px'
                            }}>
                                <div style={{ fontSize: '48px', background: 'rgba(0,0,0,0.2)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {faculty?.userFacultyInfo?.emoji || '🎓'}
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4em' }}>{faculty?.userFacultyInfo?.name || gameState.faculty}</h3>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.9em', opacity: 0.9 }}>
                                        <span><i data-feather="users" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '4px' }}></i>
                                            {faculty?.userFacultyLeaderboard?.length || 0} Members</span>
                                    </div>
                                </div>
                            </div>

                            <div className="leaderboard">
                                <h3>Faculty Top Contributors</h3>
                                <div className="leaderboard-list">
                                    {faculty?.loading ? (
                                        <p style={{ textAlign: 'center', opacity: 0.6 }}>Loading faculty data...</p>
                                    ) : faculty?.userFacultyLeaderboard && faculty.userFacultyLeaderboard.length > 0 ? (
                                        faculty.userFacultyLeaderboard.map((member, index) => (
                                            <div key={member.id} className={`leaderboard-item ${member.isCurrentUser ? 'current-user' : ''}`}>
                                                <div className="rank">{getRankEmoji(index)}</div>
                                                <div className="player-info">
                                                    <span className="player-name">
                                                        {member.name} {member.isCurrentUser && '(You)'}
                                                    </span>
                                                </div>
                                                <div className="player-score">
                                                    <span>{member.weeklyHours} hrs</span>
                                                    <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '8px' }}>
                                                        <i data-feather="zap" style={{ width: '10px', height: '10px' }}></i> {member.streak}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ textAlign: 'center', opacity: 0.6 }}>No data yet for this faculty.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── INTERFACULTY TAB ── */}
            {activeTab === 'interfaculty' && (
                <div className="interfaculty-section">
                    <p style={{ marginBottom: '20px', opacity: 0.8, lineHeight: 1.5 }}>
                        See which faculty on campus is logging the most focus time this week. Represent your faculty and climb the ranks!
                    </p>

                    <div className="leaderboard">
                        <div className="leaderboard-list interfaculty-list">
                            {faculty?.loading ? (
                                <p style={{ textAlign: 'center', opacity: 0.6 }}>Loading campus rankings...</p>
                            ) : faculty?.interfacultyRankings && faculty.interfacultyRankings.length > 0 ? (
                                faculty.interfacultyRankings.map((fac, index) => {
                                    const isUserFaculty = fac.facultyId === gameState.faculty;
                                    return (
                                        <div key={fac.facultyId} className={`leaderboard-item ${isUserFaculty ? 'current-user' : ''}`} style={{ padding: '16px' }}>
                                            <div className="rank" style={{ fontSize: '1.4em', width: '40px' }}>{getRankEmoji(index)}</div>

                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontSize: '24px', background: 'rgba(255,255,255,0.1)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {fac.emoji}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: fac.color }}>
                                                        {fac.name} {isUserFaculty && ' (Your Faculty)'}
                                                    </div>
                                                    <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '4px' }}>
                                                        {fac.studentCount} active students
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="player-score" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#4CAF50' }}>{fac.totalHours} hrs</span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p style={{ textAlign: 'center', opacity: 0.6 }}>No interfaculty data available.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

window.CommunityPanel = CommunityPanel;
