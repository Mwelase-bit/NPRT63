// CommunityPanel.jsx - everything social in one place:
//   Leaderboard : campus stats plus Global, My Faculty and Campus rankings
//   Friends     : friend code / QR / link, requests, friends ranked by focus time
//   Groups      : class groups with a weekly leaderboard, joined by code, link or QR
//   Study rooms : shared sessions where everyone sees who is focusing
// The last three are provided by SocialPanel, embedded here without its own card.
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const CommunityPanel = ({ gameState, rewards, faculty, onStartRoom, activeRoomId, initialView, onViewConsumed }) => {
    // Which part of Community is showing, and which leaderboard inside it
    const [section, setSection] = useState('leaderboard');
    const [board, setBoard] = useState('global');
    const [badges, setBadges] = useState({ friends: 0, rooms: 0 });

    // Campus-wide numbers and the global ranking
    const [globalStats, setGlobalStats] = useState({ totalMembers: 0, totalHours: 0, totalHouses: 0, averageStreak: 0 });
    const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Load the campus numbers. Failures are shown to the student (with a retry), never swallowed silently.
    const loadCommunityData = useCallback(async () => {
        if (!gameState?.token) { setLoading(false); return; }
        setLoading(true);
        setLoadError('');
        try {
            const [summaryRes, globalRes] = await Promise.all([
                window.api.leaderboard.getSummary(),
                window.api.leaderboard.getGlobal()
            ]);
            setGlobalStats(summaryRes);
            setGlobalLeaderboard(Array.isArray(globalRes.leaderboard) ? globalRes.leaderboard : []);
            if (faculty && faculty.refreshLeaderboards) faculty.refreshLeaderboards();
        } catch (err) {
            console.error('Failed to load community data', err);
            setLoadError(err.message || 'Could not load the leaderboards.');
        } finally {
            setLoading(false);
        }
    }, [gameState?.token]);

    useEffect(() => { loadCommunityData(); }, [loadCommunityData]);

    // An invite link or QR scan lands on the right section
    useEffect(() => {
        if (initialView && initialView.tab) setSection(initialView.tab);
    }, [initialView]);

    const SU = window.SocialUI || {};
    const Avatar = SU.SoAvatar || (() => null);

    const rankLabel = (i) => i + 1;
    const streakText = (n) => (n > 0 ? `${n}-day streak` : 'No streak');

    const sections = [
        { id: 'leaderboard', label: 'Leaderboard' },
        { id: 'friends', label: 'Friends', badge: badges.friends },
        { id: 'groups', label: 'Groups' },
        { id: 'rooms', label: 'Study rooms', badge: badges.rooms }
    ];
    const boards = [
        { id: 'global', label: 'Global' },
        { id: 'faculty', label: 'My faculty' },
        { id: 'interfaculty', label: 'Campus' }
    ];

    // One ranked row, shared by every leaderboard
    const Row = ({ i, name, sub, value, unit, me, tail }) => (
        <div className={`so-row ${me ? 'is-me' : ''}`}>
            <span className="so-rank">{rankLabel(i)}</span>
            <Avatar name={name} />
            <div className="so-row-main">
                <div className="so-name">{name}{me ? ' (you)' : ''}</div>
                <div className="so-meta">{sub}</div>
            </div>
            {tail}
            <div className="so-stat"><strong>{value}</strong><span>{unit}</span></div>
        </div>
    );

    const stats = [
        { value: globalStats.totalMembers, label: 'Students' },
        { value: `${globalStats.totalHours} hrs`, label: 'Studied' },
        { value: globalStats.totalHouses, label: 'Houses built' },
        { value: globalStats.averageStreak, label: 'Avg. streak' }
    ];

    return (
        <div className="community-panel co-panel">
            <h2>Community</h2>

            <div className="co-tabs" role="tablist">
                {sections.map(s => (
                    <button key={s.id} type="button" role="tab" aria-selected={section === s.id}
                        className={`co-tab ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)}>
                        {s.label}{s.badge > 0 && <span className="so-badge">{s.badge}</span>}
                    </button>
                ))}
            </div>

            {section === 'leaderboard' && (
                <div>
                    <div className="co-stats">
                        {stats.map(s => (
                            <div key={s.label} className="co-stat"><strong>{loading ? '–' : s.value}</strong><span>{s.label}</span></div>
                        ))}
                    </div>

                    {loadError && (
                        <div className="so-error" role="alert">
                            {loadError} <button type="button" className="so-btn" style={{ marginLeft: 8 }} onClick={loadCommunityData}>Try again</button>
                        </div>
                    )}

                    <div className="so-chips co-boards" role="group" aria-label="Leaderboard">
                        {boards.map(b => (
                            <button key={b.id} type="button" className={`so-chip ${board === b.id ? 'is-on' : ''}`} onClick={() => setBoard(b.id)}>{b.label}</button>
                        ))}
                    </div>

                    {board === 'global' && (
                        <section className="so-section">
                            <h3>Top students on campus</h3>
                            {loading && <div className="so-empty">Loading rankings…</div>}
                            {!loading && !loadError && globalLeaderboard.length === 0 && <div className="so-empty-card">No sessions have been finished yet. Be the first on the board.</div>}
                            {!loading && globalLeaderboard.slice(0, 10).map((p, i) => (
                                <Row key={p.id} i={i} name={p.name} me={p.isCurrentUser}
                                    sub={`${p.facultyName || ''} · ${streakText(p.streak)} · ${p.housesBuilt} houses`}
                                    value={`${p.totalHours} hrs`} unit="focused" />
                            ))}
                        </section>
                    )}

                    {board === 'faculty' && (
                        <section className="so-section">
                            {!gameState.faculty ? (
                                <div className="so-empty-card">You have not chosen a faculty yet.</div>
                            ) : (
                                <>
                                    <h3>{(faculty && faculty.userFacultyInfo && faculty.userFacultyInfo.name) || gameState.faculty}
                                        <span className="so-count">{(faculty && faculty.facultyLeaderboard && faculty.facultyLeaderboard.length) || 0} members</span></h3>
                                    {faculty && faculty.loading && <div className="so-empty">Loading your faculty…</div>}
                                    {faculty && !faculty.loading && (!faculty.facultyLeaderboard || faculty.facultyLeaderboard.length === 0) && (
                                        <div className="so-empty-card">No sessions finished in your faculty this week.</div>
                                    )}
                                    {faculty && !faculty.loading && (faculty.facultyLeaderboard || []).map((m, i) => (
                                        <Row key={m.id} i={i} name={m.name} me={m.isCurrentUser}
                                            sub={streakText(m.streak)} value={`${m.weeklyHours} hrs`} unit="this week" />
                                    ))}
                                </>
                            )}
                        </section>
                    )}

                    {board === 'interfaculty' && (
                        <section className="so-section">
                            <h3>Faculty vs faculty, this week</h3>
                            {faculty && faculty.loading && <div className="so-empty">Loading campus rankings…</div>}
                            {faculty && !faculty.loading && (!faculty.interfacultyRankings || faculty.interfacultyRankings.length === 0) && (
                                <div className="so-empty-card">No campus data yet.</div>
                            )}
                            {faculty && !faculty.loading && (faculty.interfacultyRankings || []).map((f, i, all) => {
                                const top = Math.max(1, ...all.map(x => x.totalHours || 0));
                                const mine = f.faculty === gameState.faculty;
                                return (
                                    <div key={f.faculty} className={`so-row co-faculty ${mine ? 'is-me' : ''}`}>
                                        <span className="so-rank">{rankLabel(i)}</span>
                                        <div className="so-row-main">
                                            <div className="so-name">{f.name}{mine ? ' (your faculty)' : ''}</div>
                                            <div className="co-bar"><span style={{ width: `${Math.round(((f.totalHours || 0) / top) * 100)}%`, background: f.color || '#60a5fa' }} /></div>
                                            <div className="so-meta">{f.studentCount} active students</div>
                                        </div>
                                        <div className="so-stat"><strong>{f.totalHours} hrs</strong><span>focused</span></div>
                                    </div>
                                );
                            })}
                        </section>
                    )}
                </div>
            )}

            {/* Always mounted (hidden on the leaderboard) so the "friend requests" and "rooms to join"
                badges stay up to date and invite links work from any tab */}
            {window.SocialPanel && (
                <div hidden={section === 'leaderboard'}>
                    <window.SocialPanel
                        embedded
                        section={section === 'leaderboard' ? 'friends' : section}
                        gameState={gameState}
                        onStartRoom={onStartRoom}
                        activeRoomId={activeRoomId}
                        initialView={initialView}
                        onViewConsumed={onViewConsumed}
                        onBadges={setBadges}
                    />
                </div>
            )}
        </div>
    );
};

window.CommunityPanel = CommunityPanel;
