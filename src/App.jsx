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
const GameScene = window.GameScene;
const RegistrationModal = window.RegistrationModal;
const StudyPanel = window.StudyPanel;
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

    // All automated interruption detection has been removed.
    // The focus session ends only when:
    //   1. The timer naturally completes ✅
    //   2. The user clicks "Stop Session" ✅

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

    // Force building to start when timer becomes active
    useEffect(() => {
        if (timer.isActive && !gameState.isBuilding) {
            console.log('Timer is active but building is not - forcing building to start');
            gameState.startBuilding();
        }
    }, [timer.isActive, gameState.isBuilding]);

    // Automatically progress building stages
    useEffect(() => {
        if (timer.isActive && timer.duration > 0) {
            const progress = (timer.duration - timer.timeLeft) / timer.duration;
            let nextStage = 1;

            if (progress >= 0.75) {
                nextStage = 4;
            } else if (progress >= 0.5) {
                nextStage = 3;
            } else if (progress >= 0.25) {
                nextStage = 2;
            }

            if (gameState.buildStage !== nextStage) {
                gameState.updateBuildStage(nextStage);
                // 🔊 Sound: build stage advanced
                if (window.SoundManager) window.SoundManager.buildStageUp();
            }

            // 🔊 Tick sound for last 10 seconds
            if (timer.timeLeft <= 10 && timer.timeLeft > 0) {
                if (window.SoundManager) window.SoundManager.tick();
            }
        }
    }, [timer.timeLeft, timer.duration, timer.isActive, gameState.buildStage, gameState]);

    // Handle timer completion
    useEffect(() => {
        if (timer.isCompleted) {
            gameState.completeBuilding();
            rewards.awardCoins(timer.duration);
            rewards.updateStreak();

            // 🔊 Sound: session complete + building done
            if (window.SoundManager) {
                window.SoundManager.sessionComplete();
                setTimeout(() => window.SoundManager.coinEarned(), 600);
            }
            // 📱 Notification: session complete
            if (window.NotificationManager) {
                window.NotificationManager.sessionComplete(timer.duration);
            }

            // Sync completed session to backend
            syncSessionToBackend(timer.duration, timer.duration, true);

            // Sync new achievements unlocked from this session
            rewards.allAchievements
                .filter(a => a.unlocked && a.unlockedAt && (Date.now() - a.unlockedAt) < 10000)
                .forEach(a => {
                    window.api.achievements.unlock(a.id).catch(() => { });
                    // 🔊 + 📱 Achievement notification
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
            // 🔊 Sound: demolish
            if (window.SoundManager) window.SoundManager.demolish();
            // 📱 Notification: interrupted
            if (window.NotificationManager) window.NotificationManager.sessionInterrupted();

            // Sync interrupted session to backend
            const elapsed = sessionStartRef.current
                ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
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

    const startFocusSession = async (duration) => {
        console.log('Starting focus session with duration:', duration);

        // Record when session started (for elapsed-time tracking)
        sessionStartRef.current = Date.now();

        // Reset building state first
        gameState.resetBuilding();

        // Start timer
        timer.start(duration);

        // Start building
        gameState.startBuilding();

        // 🔊 Sound: session started
        if (window.SoundManager) window.SoundManager.sessionStart();

        setInterruptionDetected(false);
    };

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
            {/* Registration Modal — shown once on first run or if not logged in */}
            {(!gameState.token) && (
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
                        <h3>🌀 3D Engine Unavailable</h3>
                        <p style={{ opacity: 0.6 }}>The graphics engine encountered a problem.</p>
                    </div>
                }>
                    <GameScene
                        gameState={gameState}
                        timer={timer}
                        interruptionDetected={interruptionDetected}
                        housesBuilt={rewards.housesBuilt || 0}
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
                            className={`nav-tab ${activePanel === 'study' ? 'active' : ''}`}
                            onClick={() => {
                                setActivePanel('study');
                                setMobileMenuOpen(false);
                            }}
                        >
                            🧠 Study AI
                        </button>
                    </div>

                    <div className="panel-content">
                        {activePanel === 'timer' && (
                            <TimerPanel
                                timer={timer}
                                onStartSession={startFocusSession}
                                gameState={gameState}
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

                        {activePanel === 'shop' && (
                            <ShopPanel
                                gameState={gameState}
                                rewards={rewards}
                            />
                        )}
                        {activePanel === 'study' && (
                            <StudyPanel
                                currentUser={gameState.token ? { token: gameState.token } : null}
                                apiBase={window.API_BASE || ''}
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
                    {/* Timer — left side */}
                    <TimerPanel
                        timer={timer}
                        onStartSession={startFocusSession}
                        gameState={gameState}
                    />
                    {/* Study AI — right side, runs alongside timer without interrupting */}
                    <div className="study-panel-float">
                        <StudyPanel
                            currentUser={gameState.token ? { token: gameState.token } : null}
                            apiBase={window.API_BASE || ''}
                        />
                    </div>
                </div>
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
