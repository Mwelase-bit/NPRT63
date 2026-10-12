const { useState, useEffect, useRef, useCallback, useMemo } = React;
const TimerPanel = ({ timer, onStartSession, gameState }) => {
    const [hours, setHours] = useState('0');
    const [mins, setMins] = useState('25');
    const toInt = (v) => Math.max(0, parseInt(v, 10) || 0);
    const MAX_MINUTES = 12 * 60;
    const selectedMinutes = Math.min(MAX_MINUTES, toInt(hours) * 60 + toInt(mins));
    const setPreset = (total) => {
        setHours(String(Math.floor(total / 60)));
        setMins(String(total % 60));
    };
    
    const getBuildingLabel = (minutes) => {
        const tier = window.BuildingTiers.tierFor(minutes);
        return `${tier.name} (${tier.label.toLowerCase()} build)`;
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const sec = seconds % 60;
        const pad = (n) => n.toString().padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    };
    
    const community = gameState.completedHouses || [];
    const totalMinutes = community.reduce((n, h) => n + (h.minutes || 0), 0);
    const communityLevel = (n) => {
        const L = [[0, 'Empty Plot'], [1, 'Camp'], [4, 'Hamlet'], [9, 'Village'], [16, 'Town'], [26, 'City']];
        let idx = 0;
        L.forEach((l, i) => { if (n >= l[0]) idx = i; });
        return { name: L[idx][1], next: L[idx + 1] ? L[idx + 1][0] - n : 0, nextName: L[idx + 1] ? L[idx + 1][1] : '' };
    };
    const fmtTotal = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
    const tierName = (id) => window.BuildingTiers.getTier(id).name;
    const counts = community.reduce((acc, h) => { acc[h.type] = (acc[h.type] || 0) + 1; return acc; }, {});

    const getProgressPercentage = () => {
        if (!timer.duration) return 0;
        return ((timer.duration - timer.timeLeft) / timer.duration) * 100;
    };
    
    return (
        <div className={`timer-panel ${timer.isActive ? 'timer-panel--active' : ''} ${timer.isCompleted ? 'timer-panel--summary' : ''}`}>
            <h2>Focus Session</h2>
            
            {timer.isCompleted ? null : !timer.isActive ? (
                <div className="timer-setup">
                    <div className="duration-selector">
                        <h4>Set Focus Duration:</h4>
                        <div className="time-picker">
                            {[
                                { key: 'h', label: 'Hours', value: hours, set: setHours, max: 12, step: 1 },
                                { key: 'm', label: 'Minutes', value: mins, set: setMins, max: 59, step: 5 }
                            ].map((f, idx) => (
                                <React.Fragment key={f.key}>
                                    {idx === 1 && <div className="time-colon">:</div>}
                                    <div className="time-col">
                                        <button type="button" className="time-step" aria-label={`More ${f.label.toLowerCase()}`}
                                            onClick={() => f.set(String(Math.min(f.max, toInt(f.value) + f.step)))}>
                                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                        <input
                                            className="time-digits"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={2}
                                            value={f.value.toString().padStart(2, '0')}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/\D/g, '').slice(-2);
                                                f.set(String(Math.min(f.max, toInt(v))));
                                            }}
                                            aria-label={`Study ${f.label.toLowerCase()}`}
                                        />
                                        <button type="button" className="time-step" aria-label={`Less ${f.label.toLowerCase()}`}
                                            onClick={() => f.set(String(Math.max(0, toInt(f.value) - f.step)))}>
                                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                        <span className="time-unit">{f.label}</span>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="duration-presets">
                            {[15, 25, 45, 60, 90, 120].map(m => (
                                <button key={m} type="button"
                                    className={`duration-preset ${selectedMinutes === m ? 'active' : ''}`}
                                    onClick={() => setPreset(m)}>
                                    {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {community.length > 0 && (
                        <div className="community-mini">
                            <i data-feather="users"></i>
                            {community.length} building{community.length > 1 ? 's' : ''} · {communityLevel(community.length).name} · {fmtTotal(totalMinutes)} focused
                        </div>
                    )}
                    <div className="house-preview">
                        <h4>Current Project:</h4>
                        <div className="build-stages">
                            <div className="stage">
                                <i data-feather="home"></i>
                                Ready to build: {getBuildingLabel(selectedMinutes)}
                            </div>
                        </div>
                    </div>
                    
                    <button
                        className="start-btn btn btn-primary btn-lg"
                        disabled={selectedMinutes < 1}
                        onClick={() => onStartSession(selectedMinutes * 60)}
                    >
                        <i data-feather="play"></i>
                        Start Focus Session
                    </button>
                </div>
            ) : (
                <div className="timer-active">
                    <div className="timer-display">
                        <div className="time-remaining time-remaining--units" aria-label={`${formatTime(timer.timeLeft)} remaining`}>
                            {[
                                ['h', Math.floor(timer.timeLeft / 3600)],
                                ['m', Math.floor((timer.timeLeft % 3600) / 60)],
                                ['s', timer.timeLeft % 60]
                            ].filter(([u, v]) => u !== 'h' || timer.duration >= 3600).map(([u, v]) => (
                                <span key={u} className="tr-unit">
                                    <span className="tr-num">{String(v).padStart(2, '0')}</span>
                                    <span className="tr-lbl">{u === 'h' ? 'hrs' : u === 'm' ? 'min' : 'sec'}</span>
                                </span>
                            ))}
                        </div>
                        
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                        
                        <div className="session-info">
                            <span>Building Stage: {gameState.buildStage}/4</span>
                            <span>Total Time: {formatTime(timer.duration)}</span>
                        </div>
                    </div>
                    
                    <div className="timer-controls">
                        <button
                            className="btn btn-danger btn-lg"
                            onClick={() => {
                                timer.stop();
                                gameState.resetBuilding();
                            }}
                        >
                            <i data-feather="square"></i>
                            Stop Session
                        </button>
                    </div>
                    
                    <div className="focus-tips">
                        <p><strong>Stay Focused!</strong> Any interruption will cause the house to crumble!</p>
                        <p>Current House: {gameState.currentHouse}</p>
                    </div>
                </div>
            )}
            
            {timer.isCompleted && (() => {
                const lvl = communityLevel(community.length);
                return (
                    <div className="session-summary">
                        <div className="summary-badge"><i data-feather="check-circle"></i></div>
                        <h3>Building complete!</h3>
                        <p className="summary-sub">
                            Your {tierName(gameState.currentHouse)} is finished after {fmtTotal(Math.round(timer.duration / 60))} of focus.
                        </p>
                        <div className="summary-stats">
                            <div><strong>{community.length}</strong><span>Buildings</span></div>
                            <div><strong>{fmtTotal(totalMinutes)}</strong><span>Total focus</span></div>
                            <div><strong>{lvl.name}</strong><span>Community</span></div>
                        </div>
                        <div className="summary-bar">
                            <div className="summary-bar-fill" style={{ width: lvl.next ? `${100 - Math.min(100, lvl.next * 100 / (lvl.next + 1))}%` : '100%' }}></div>
                        </div>
                        <p className="summary-next">
                            {lvl.next ? `${lvl.next} more building${lvl.next > 1 ? 's' : ''} to grow into a ${lvl.nextName}` : 'Your community is a thriving City!'}
                        </p>
                        <div className="summary-chips">
                            {Object.keys(counts).map(id => (
                                <span key={id} className="summary-chip">{tierName(id)} ×{counts[id]}</span>
                            ))}
                        </div>
                        <button className="start-btn btn btn-primary btn-lg" onClick={() => timer.stop()}>
                            <i data-feather="plus-square"></i>
                            Build the next one
                        </button>
                    </div>
                );
            })()}
        </div>
    );
};

window.TimerPanel = TimerPanel;
