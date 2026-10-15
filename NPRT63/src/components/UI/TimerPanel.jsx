const { useState, useEffect, useRef, useCallback, useMemo } = React;
const TimerPanel = ({ timer, onStartSession, onEndSession, gameState, roomTitle }) => {
    const [hours, setHours] = useState('0');
    const [mins, setMins] = useState('25');
    const toInt = (v) => Math.max(0, parseInt(v, 10) || 0);
    const MAX_MINUTES = 12 * 60;
    const selectedMinutes = Math.min(MAX_MINUTES, toInt(hours) * 60 + toInt(mins));
    const setPreset = (total) => {
        setHours(String(Math.floor(total / 60)));
        setMins(String(total % 60));
    };

    const tierName = (id) => window.BuildingTiers.getTier(id).name;
    const pad = (n) => n.toString().padStart(2, '0');
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const sec = seconds % 60;
        return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    };
    const progress = timer.duration ? ((timer.duration - timer.timeLeft) / timer.duration) * 100 : 0;
    const stateClass = timer.isCompleted ? 'tp--done' : timer.isActive ? 'tp--active' : 'tp--setup';

    // ── Session finished ────────────────────────────────────────────────
    if (timer.isCompleted) {
        return (
            <div className={`timer-panel tp ${stateClass}`}>
                <div className="tp-eyebrow">Session complete</div>
                <div className="tp-done-title">{tierName(gameState.currentHouse)} finished</div>
                <p className="tp-done-sub">{formatTime(timer.duration)} of focus. Nicely done.</p>
                <button className="tp-btn tp-btn--primary" onClick={() => timer.stop()}>Build the next one</button>
            </div>
        );
    }

    // ── Session running ─────────────────────────────────────────────────
    if (timer.isActive) {
        return (
            <div className={`timer-panel tp ${stateClass}`}>
                <div className="tp-eyebrow">{timer.isPaused ? 'Paused' : 'Focusing'} &middot; {tierName(gameState.currentHouse)}</div>
                {roomTitle && <div className="tp-room">With your study room: {roomTitle}</div>}
                <div className="tp-clock" role="timer" aria-label={`${formatTime(timer.timeLeft)} remaining`}>
                    {formatTime(timer.timeLeft)}
                </div>
                <div className="tp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
                    <div className="tp-progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="tp-meta">
                    <span>Stage {gameState.buildStage} of 4</span>
                    <span>{formatTime(timer.duration)} session</span>
                </div>
                <div className="tp-actions">
                    <button
                        className="tp-btn tp-btn--ghost"
                        onClick={() => {
                            // The app records the early end; without it (older callers) just stop
                            if (onEndSession) onEndSession();
                            else { timer.stop(); gameState.resetBuilding(); }
                        }}
                    >
                        End session
                    </button>
                </div>
                <p className="tp-hint">Stay on this page. Clicking the scene collapses your building.</p>
            </div>
        );
    }

    // ── Set up a session ────────────────────────────────────────────────
    const fields = [
        { key: 'h', label: 'Hours', value: hours, set: setHours, max: 12, step: 1 },
        { key: 'm', label: 'Minutes', value: mins, set: setMins, max: 59, step: 5 }
    ];
    return (
        <div className={`timer-panel tp ${stateClass}`}>
            <div className="tp-eyebrow">New focus session</div>
            <div className="tp-picker">
                {fields.map((f, idx) => (
                    <React.Fragment key={f.key}>
                        {idx === 1 && <div className="tp-colon">:</div>}
                        <div className="tp-field">
                            <button type="button" className="tp-step" aria-label={`More ${f.label.toLowerCase()}`}
                                onClick={() => f.set(String(Math.min(f.max, toInt(f.value) + f.step)))}>
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 14l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                            <input
                                className="tp-digits"
                                type="text"
                                inputMode="numeric"
                                maxLength={2}
                                value={pad(toInt(f.value))}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, '').slice(-2);
                                    f.set(String(Math.min(f.max, toInt(v))));
                                }}
                                aria-label={`Study ${f.label.toLowerCase()}`}
                            />
                            <button type="button" className="tp-step" aria-label={`Less ${f.label.toLowerCase()}`}
                                onClick={() => f.set(String(Math.max(0, toInt(f.value) - f.step)))}>
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                            <span className="tp-unit">{f.label}</span>
                        </div>
                    </React.Fragment>
                ))}
            </div>

            <div className="tp-presets">
                {[15, 25, 45, 60, 90, 120].map(m => (
                    <button key={m} type="button"
                        className={`tp-chip ${selectedMinutes === m ? 'is-on' : ''}`}
                        onClick={() => setPreset(m)}>
                        {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`}
                    </button>
                ))}
            </div>

            <div className="tp-build">
                <span className="tp-build-label">You will build</span>
                <span className="tp-build-name">{selectedMinutes > 0 ? window.BuildingTiers.tierFor(selectedMinutes).name : 'Pick a time'}</span>
            </div>

            <button
                className="tp-btn tp-btn--primary"
                disabled={selectedMinutes < 1}
                onClick={() => onStartSession(selectedMinutes * 60)}
            >
                Start session
            </button>
        </div>
    );
};

window.TimerPanel = TimerPanel;
