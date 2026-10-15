const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Import components and hooks from window (set by other scripts in Babel standalone environment)
const useGameState = window.useGameState;
const useTimer = window.useTimer;
const useRewards = window.useRewards;
const useFaculty = window.useFaculty;
const TimerPanel = window.TimerPanel;
const RewardPanel = window.RewardPanel;
const ProfilePanel = window.ProfilePanel;
const CommunityPanel = window.CommunityPanel;
const ShopPanel = window.ShopPanel;
const AnalyticsPanel = window.AnalyticsPanel;
const SocialPanel = window.SocialPanel;
const InviteDialog = window.InviteDialog;
const GameScene = window.GameScene;
const RegistrationModal = window.RegistrationModal;
const StudyPanel = window.StudyPanel;
const StudyLogo = window.StudyLogo;
const ErrorBoundary = ({ children, fallback }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const handleError = (error) => {
            console.error('ErrorBoundary caught an error:', error);
            setHasError(true);
        };

        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    if (hasError) return fallback;
    return children;
};

const App = () => {
    const gameState = useGameState();
    const timer = useTimer();
    const rewards = useRewards(gameState, timer);
    const faculty = useFaculty(gameState, rewards);

    const [activePanel, setActivePanel] = useState('timer');
    const [interruptionDetected, setInterruptionDetected] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // Study AI floating panel — one instance for the whole app, controlled here
    // so the nav tab and the floating button always agree.
    const [studyOpen, setStudyOpen] = useState(false);

    // All automated interruption detection has been removed.
    // The focus session ends only when:
 // 1. The timer naturally completes
 // 2. The user clicks "Stop Session"

    // Request notification permission after login/registration
    useEffect(() => {
        if (gameState.token && window.NotificationManager) {
            window.NotificationManager.requestPermission();
            // Start streak reminder scheduler
            window.NotificationManager.startStreakReminder(
                () => rewards.lastFocusDate,
                () => rewards.streak
            );
        }
        return () => {
            if (window.NotificationManager) window.NotificationManager.stopStreakReminder();
        };
    }, [gameState.token]);

    // Usage analytics: count an app visit when a saved sign-in is restored, and
    // report time spent in the app (only while the tab is visible) every 30 s.
    useEffect(() => {
        if (!gameState.token || gameState.authRestoring) return;
        window.api.analytics.visit().catch(() => { });
        let last = Date.now();
        const tick = () => {
            const now = Date.now();
            const secs = Math.round((now - last) / 1000);
            last = now;
            if (document.visibilityState !== 'visible' || secs < 1) return;
            window.api.analytics.heartbeat(Math.min(secs, 120)).catch(() => { });
        };
        const onVisible = () => { if (document.visibilityState === 'visible') last = Date.now(); };
        const timer = setInterval(tick, 30000);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [gameState.token, gameState.authRestoring]);

    // Force building to start when timer becomes active
    useEffect(() => {
        if (timer.isActive && !gameState.isBuilding) {
            console.log('Timer is active but building is not - forcing building to start');
            gameState.startBuilding();
        }
    }, [timer.isActive, gameState.isBuilding]);

    // The building rises with THIS session's progress (each session builds one
    // building, sized by its length); each finished building stays on screen after the session.
    useEffect(() => {
        if (timer.isActive && timer.duration > 0) {
            const progress = (timer.duration - timer.timeLeft) / timer.duration;
            const nextStage = Math.min(4, 1 + Math.floor(progress * 4));

            if (gameState.buildStage !== nextStage) {
                gameState.updateBuildStage(nextStage);
 // Sound: build stage advanced
                if (window.SoundManager) window.SoundManager.buildStageUp();
            }

 // Tick sound for last 10 seconds
            if (timer.timeLeft <= 10 && timer.timeLeft > 0) {
                if (window.SoundManager) window.SoundManager.tick();
            }
        }
    }, [timer.timeLeft, timer.duration, timer.isActive, gameState.buildStage, gameState, rewards.totalFocusTime]);

    // Handle timer completion: the finished building stays on screen
    // and stays on screen together with the user's progress.
    useEffect(() => {
        if (timer.isCompleted) {
            gameState.completeBuilding(Math.round(timer.duration / 60));
            rewards.awardCoins(timer.duration);
            rewards.updateStreak();

 // Sound: session complete + building done
            if (window.SoundManager) {
                window.SoundManager.sessionComplete();
                setTimeout(() => window.SoundManager.coinEarned(), 600);
            }
 // Notification: session complete
            if (window.NotificationManager) {
                window.NotificationManager.sessionComplete(timer.duration);
            }

            // Sync completed session to backend (backend also gates houses_built on 45 min)
            // then re-read authoritative stats as the single source of truth.
            syncSessionToBackend(timer.duration, timer.duration, true).then(() => {
                rewards.syncWithBackend();
            });

            // Sync new achievements unlocked from this session
            rewards.allAchievements
                .filter(a => a.unlocked && a.unlockedAt && (Date.now() - a.unlockedAt) < 10000)
                .forEach(a => {
                    window.api.achievements.unlock(a.id).catch(() => { });
 // +  Achievement notification
                    if (window.SoundManager) window.SoundManager.achievementUnlocked();
                    if (window.NotificationManager) window.NotificationManager.achievementUnlocked(a.title || a.name);
                });

            setInterruptionDetected(false);
            sessionStartRef.current = null;
        }
    }, [timer.isCompleted]);

    // Handle interruption effects
    useEffect(() => {
        if (interruptionDetected) {
            // (The demolish sound is played in handleDemolish, inside the click
            //  that caused the collapse, so browsers allow the audio.)
            // Notification: interrupted
            if (window.NotificationManager) window.NotificationManager.sessionInterrupted();

            // Sync interrupted session to backend
            // Whole seconds, never more than the planned duration (the API rejects both)
            // Focused time only: the timer is paused while the student is away
            const elapsed = sessionStartRef.current
                ? Math.max(0, Math.min(timer.duration, timer.duration - timer.timeLeft))
                : 0;
            syncSessionToBackend(timer.duration, elapsed, false);
            sessionStartRef.current = null;

            setTimeout(() => {
                setInterruptionDetected(false);
            }, 3000);
        }
    }, [interruptionDetected]);

    // Track when a session started (for elapsed time calc on interruption)
    const sessionStartRef = React.useRef(null);

    // ── Study rooms: a session started from a room reports its progress to it ──
    const [activeRoom, setActiveRoom] = useState(null);       // { id, title }
    const activeRoomRef = React.useRef(null);
    activeRoomRef.current = activeRoom;
    const postRoomStatus = useCallback((status) => {
        const r = activeRoomRef.current;
        if (r) window.api.social.roomStatus(r.id, status).catch(() => { });
    }, []);

    // ── Invite links and QR scans: /?invite=CODE ────────────────────────────
    const [socialView, setSocialView] = useState(null);
    const [inviteCode, setInviteCode] = useState(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('invite');
            if (code) {
                sessionStorage.setItem('bh_pending_invite', code);
                params.delete('invite');
                const qs = params.toString();
                window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
            }
        } catch (e) { /* storage or history unavailable */ }
        return null;
    });
    useEffect(() => {
        if (!gameState.token || gameState.authRestoring) return;
        try {
            const pending = sessionStorage.getItem('bh_pending_invite');
            if (pending) { sessionStorage.removeItem('bh_pending_invite'); setInviteCode(pending); }
        } catch (e) { /* ignore */ }
    }, [gameState.token, gameState.authRestoring]);

    // Called the moment a building starts collapsing (a click on the scene, or the
    // student leaving the app for too long). Plays the crash sound and flags the
    // interruption so the session is recorded as interrupted. Only the first call
    // per session counts.
    const demolishedRef = React.useRef(false);
    const handleDemolish = useCallback(() => {
        if (demolishedRef.current) return;
        demolishedRef.current = true;
        if (window.SoundManager) window.SoundManager.demolish();
        setInterruptionDetected(true);
        postRoomStatus('interrupted');
    }, []);

    // ── Leaving the app mid-session ─────────────────────────────────────
    // Leaving the tab/app pauses the session and opens a 30 s return window.
    // Back in time: carry on. Not back: the building collapses.
    const [collapseSignal, setCollapseSignal] = useState(0);
    const [leaveBanner, setLeaveBanner] = useState(null);   // { phase: 'away' | 'back', deadline }
    const [leaveClock, setLeaveClock] = useState(0);
    const timerRef = React.useRef(timer);
    timerRef.current = timer;
    const guardRef = React.useRef(null);

    useEffect(() => {
        const guard = window.LeaveGuard.create({
            onAway: ({ deadline }) => {
                timerRef.current.pause();
                setLeaveBanner({ phase: 'away', deadline });
                if (window.NotificationManager) window.NotificationManager.leaveWarning(Math.round(window.LeaveGuard.GRACE_MS / 1000));
            },
            onBack: ({ awayMs }) => {
                timerRef.current.resume();
                setLeaveBanner({ phase: 'back', awayMs });
                setTimeout(() => setLeaveBanner(b => (b && b.phase === 'back' ? null : b)), 4000);
            },
            onExpire: () => {
                setLeaveBanner(null);
                try { sessionStorage.setItem('bh_collapsed_reason', 'left'); } catch (e) { }
                handleDemolish();                       // record it right away, even if the tab is hidden
                setCollapseSignal(n => n + 1);          // the scene plays the collapse as soon as it is visible
            }
        });
        guardRef.current = guard;
        window.LeaveGuard.register(guard);
        const detach = window.LeaveGuard.attach(guard);
        return () => { detach(); window.LeaveGuard.register(null); };
    }, []);

    // Detection runs only while a session is running
    useEffect(() => {
        if (guardRef.current) guardRef.current.setActive(timer.isActive && !timer.isCompleted);
        if (!timer.isActive) setLeaveBanner(null);
    }, [timer.isActive, timer.isCompleted]);

    // Live countdown on the banner (visible when the window is only unfocused)
    useEffect(() => {
        if (!leaveBanner || leaveBanner.phase !== 'away') return;
        const id = setInterval(() => setLeaveClock(Date.now()), 250);
        return () => clearInterval(id);
    }, [leaveBanner]);

    // After a collapse caused by leaving, the page reloads; explain what happened
    const [collapseNotice, setCollapseNotice] = useState(() => {
        try {
            const r = sessionStorage.getItem('bh_collapsed_reason');
            if (r) sessionStorage.removeItem('bh_collapsed_reason');
            return r === 'left';
        } catch (e) { return false; }
    });
    useEffect(() => {
        if (!collapseNotice) return;
        const id = setTimeout(() => setCollapseNotice(false), 9000);
        return () => clearTimeout(id);
    }, [collapseNotice]);

    const startFocusSession = async (duration) => {
        console.log('Starting focus session with duration:', duration);

        // Record when session started (for elapsed-time tracking)
        sessionStartRef.current = Date.now();
        demolishedRef.current = false;

        // Pick the building size from the session length, then reset
        gameState.setHouseForDuration(duration);
        gameState.resetBuilding();

        // Start timer
        timer.start(duration);

        // Start building
        gameState.startBuilding();

 // Sound: session started
        if (window.SoundManager) window.SoundManager.sessionStart();

        setInterruptionDetected(false);
    };

    // Start my own timer for a study room's length and tell the room I am focusing
    const startRoomSession = async (room) => {
        const info = { id: room.id, title: room.title };
        setActiveRoom(info);
        activeRoomRef.current = info;
        try {
            if (room.myStatus && room.myStatus !== 'joined' && room.myStatus !== 'focusing') await window.api.social.roomStatus(room.id, 'joined');
            await window.api.social.roomStatus(room.id, 'focusing');
        } catch (e) { /* the session still runs; the room just will not show it */ }
        setActivePanel('timer');
        await startFocusSession(room.durationMin * 60);
    };

    // When a session ends, report how it went to the room it was started from
    const wasActiveRef = React.useRef(false);
    useEffect(() => {
        if (wasActiveRef.current && !timer.isActive && activeRoomRef.current) {
            postRoomStatus(timer.isCompleted ? 'completed' : 'interrupted');
            setActiveRoom(null);
        }
        wasActiveRef.current = timer.isActive;
    }, [timer.isActive, timer.isCompleted]);

    // POST a finished or interrupted session to the backend
    const syncSessionToBackend = async (duration, elapsed, completed) => {
        if (!gameState.token) return; // Only sync when logged in
        try {
            await window.api.sessions.create({ duration, elapsed, completed });
            console.log(`Session synced: completed=${completed}, elapsed=${elapsed}s`);
        } catch (err) {
            console.warn('Failed to sync session to backend:', err.message);
        }
    };

    return (
        <div className="app">
            {/* ⏳ Session-restore loading screen — shown while we verify the saved JWT */}
            {gameState.authRestoring && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 99999, color: 'white',
                    fontFamily: "'Inter', sans-serif"
                }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px' }}><window.FeatherIcon name="home" size={56} gap={0} /></div>
                    <h2 style={{ margin: '0 0 10px', fontWeight: 700 }}>BUILDHAUS</h2>
                    <p style={{ opacity: 0.6, margin: '0 0 30px' }}>Restoring your session...</p>
                    <div style={{
                        width: '48px', height: '48px',
                        border: '4px solid rgba(255,255,255,0.2)',
                        borderTop: '4px solid #4CAF50',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* Backend offline warning banner */}
            {!gameState.authRestoring && gameState.backendOffline && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0,
                    background: 'linear-gradient(90deg, #ff9800, #f57c00)',
                    color: 'white', textAlign: 'center',
                    padding: '10px 20px', zIndex: 9998,
                    fontFamily: "'Inter', sans-serif", fontSize: '0.9em',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)'
                }}>
                    <window.FeatherIcon name="alert-triangle" /> <strong>Server offline</strong> — Start the backend server to save progress &amp; see community data.
                    &nbsp;<button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.5)',
                            color: 'white', borderRadius: '6px', padding: '3px 12px',
                            cursor: 'pointer', marginLeft: '10px', fontWeight: 600
                        }}
                    >Retry</button>
                </div>
            )}

            {inviteCode && gameState.token && (
                <InviteDialog
                    code={inviteCode}
                    onClose={() => setInviteCode(null)}
                    onDone={(v) => { setInviteCode(null); setSocialView(v); setActivePanel('social'); }}
                />
            )}

            {/* Leaving the app mid-session: return window / welcome back / collapse notice */}
            {leaveBanner && leaveBanner.phase === 'away' && (
                <div className="leave-banner leave-banner--warn" role="alert">
                    <strong>Come back to your session</strong>
                    <span>Your building collapses in {Math.max(0, Math.ceil((leaveBanner.deadline - (leaveClock || Date.now())) / 1000))}s. The timer is paused.</span>
                </div>
            )}
            {leaveBanner && leaveBanner.phase === 'back' && (
                <div className="leave-banner leave-banner--ok" role="status">
                    <strong>Welcome back</strong>
                    <span>You were away {Math.round(leaveBanner.awayMs / 1000)}s. The timer was paused, so nothing was lost.</span>
                </div>
            )}
            {collapseNotice && (
                <div className="leave-banner leave-banner--bad" role="alert">
                    <strong>Your building collapsed</strong>
                    <span>You left the app for more than {Math.round(window.LeaveGuard.GRACE_MS / 1000)} seconds. Stay on the page to keep building.</span>
                </div>
            )}

            {/* Registration Modal — shown only when there is truly no active session */}
            {!gameState.authRestoring && !gameState.token && !gameState.backendOffline && (
                <RegistrationModal gameState={gameState} />
            )}

            {/* 3D Game Scene */}
            <div className="game-canvas">
                <ErrorBoundary fallback={
                    <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        background: '#1a1a2e', color: 'white'
                    }}>
                        <h3><window.FeatherIcon name="alert-circle" />3D Engine Unavailable</h3>
                        <p style={{ opacity: 0.6 }}>The graphics engine encountered a problem.</p>
                    </div>
                }>
                    <GameScene
                        gameState={gameState}
                        timer={timer}
                        interruptionDetected={interruptionDetected}
                        housesBuilt={rewards.housesBuilt || 0}
                        onDemolish={handleDemolish}
                        collapseSignal={collapseSignal}
                    />
                </ErrorBoundary>
            </div>

            {/* UI Overlay */}
            {!timer.isActive ? (
                <div className="ui-overlay">
                    <button
                        className="mobile-menu-toggle"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <i data-feather="menu"></i>
                    </button>

                    <div className={`nav-tabs ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                        <button
                            className={`nav-tab ${activePanel === 'timer' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('timer');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="clock"></i>
                            Focus
                        </button>
                        <button
                            className={`nav-tab ${activePanel === 'rewards' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('rewards');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="award"></i>
                            Rewards
                        </button>
                        <button
                            className={`nav-tab ${activePanel === 'profile' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('profile');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="user"></i>
                            Profile
                        </button>
                        <button
                            className={`nav-tab ${activePanel === 'community' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('community');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="users"></i>
                            Community
                        </button>
                        <button
                            className={`nav-tab ${activePanel === 'social' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('social');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="user-plus"></i>
                            Friends
                        </button>
                        <button
                            className={`nav-tab ${activePanel === 'shop' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('shop');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="shopping-bag"></i>
                            Shop
                        </button>
                        <button
                            className={`nav-tab ${activePanel === 'insights' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('insights');
                                setMobileMenuOpen(false);
                            }}
                        >
                            <i data-feather="bar-chart-2"></i>
                            Insights
                        </button>
                        <button
                            className={`nav-tab nav-tab-study ${studyOpen ? 'active' : ''}`}
                            onClick={() => {
                                // Study AI lives in the floating panel — the tab just toggles it
                                setStudyOpen(o => !o);
                                setMobileMenuOpen(false);
                            }}
                            aria-pressed={studyOpen}
                        >
                            <StudyLogo size={18} className="nav-tab-logo" />
                            Study AI
                        </button>
                    </div>

                    <div className="panel-content">
                        {activePanel === 'timer' && (
                            <TimerPanel
                                timer={timer}
                                onStartSession={startFocusSession}
                                gameState={gameState}
                                roomTitle={activeRoom ? activeRoom.title : null}
                            />
                        )}

                        {activePanel === 'rewards' && (
                            <RewardPanel rewards={rewards} />
                        )}

                        {activePanel === 'profile' && (
                            <ProfilePanel
                                gameState={gameState}
                                rewards={rewards}
                            />
                        )}

                        {activePanel === 'community' && (
                            <CommunityPanel
                                gameState={gameState}
                                rewards={rewards}
                                faculty={faculty}
                            />
                        )}

                        {activePanel === 'social' && (
                            <SocialPanel
                                gameState={gameState}
                                onStartRoom={startRoomSession}
                                activeRoomId={activeRoom ? activeRoom.id : null}
                                initialView={socialView}
                                onViewConsumed={() => setSocialView(null)}
                            />
                        )}

                        {activePanel === 'insights' && (
                            <AnalyticsPanel gameState={gameState} />
                        )}

                        {activePanel === 'shop' && (
                            <ShopPanel
                                gameState={gameState}
                                rewards={rewards}
                            />
                        )}
                    </div>
                </div>
            ) : (
                // Timer is active — show timer bottom-left + Study panel bottom-right
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    zIndex: 200,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    pointerEvents: 'auto',
                    padding: '0 18px 18px 18px',
                    gap: '16px'
                }}>
                    {/* Timer — left side (Study AI floats bottom-right on its own) */}
                    <TimerPanel
                        timer={timer}
                        onStartSession={startFocusSession}
                        gameState={gameState}
                        roomTitle={activeRoom ? activeRoom.title : null}
                    />
                </div>
            )}

            {/* Study AI — ONE floating button + panel for every screen (idle and
                during a focus session), so the logo, position and state never
                change as you move around the app. Hidden while logging in. */}
            {!gameState.authRestoring && gameState.token && (
                <StudyPanel
                    currentUser={{ token: gameState.token }}
                    apiBase={window.API_BASE || ''}
                    isOpen={studyOpen}
                    onOpenChange={setStudyOpen}
                    timerActive={timer.isActive}
                />
            )}

            {/* Status Bar - TEMPORARILY COMMENTED OUT */}
            {/*
            <div className="status-bar">
                <div className="coins">
                    <i data-feather="dollar-sign"></i>
                    {rewards.coins}
                </div>
                <div className="streak">
                    <i data-feather="zap"></i>
                    {rewards.streak} day streak
                </div>
            </div>
            
            <div className="interruption-warning">
                <div className="warning-content">
                    <i data-feather="alert-triangle"></i>
                    <h3>Focus Interrupted!</h3>
                    <p>Your house is being demolished...</p>
                </div>
            </div>
            */}

            {/* Mobile Menu Overlay - TEMPORARILY COMMENTED OUT */}
            {/*
            {mobileMenuOpen && (
                <div 
                    className="mobile-menu-overlay"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            */}
        </div>
    );
};

window.App = App;
