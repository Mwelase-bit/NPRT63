// RewardPanel.jsx - coins, daily and weekly bonuses, streak milestones, boosters.
//
// Every number here comes from the server (GET /api/rewards/status) and every claim is
// checked and paid there, so coins can never appear on screen and then vanish after a
// refresh. The panel only shows what the server says is claimable.
const { useState, useEffect, useCallback } = React;

const RW_BOOSTERS = [
    { key: 'focus_potion', name: 'Focus Potion', what: 'Doubles the coins of your next session' },
    { key: 'xp_amplifier', name: 'XP Amplifier', what: '+50% coins for your next 3 sessions' },
    { key: 'streak_shield', name: 'Streak Shield', what: 'Saves your streak if you miss one day' }
];

// A labelled progress bar: "3 of 5"
const RwProgress = ({ label, value, target, unit }) => (
    <div className="rw-progress">
        <div className="rw-progress-row"><span>{label}</span><span>{Math.min(value, target)} / {target}{unit}</span></div>
        <div className="pf-bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={target} aria-valuenow={Math.min(value, target)}>
            <span style={{ width: `${Math.min(100, Math.round((value / target) * 100))}%` }} />
        </div>
    </div>
);

const RewardPanel = ({ rewards, gameState }) => {
    const [status, setStatus] = useState(null);       // what the server says (null while loading)
    const [loadError, setLoadError] = useState('');
    const [notice, setNotice] = useState(null);       // { text, type }
    const [busy, setBusy] = useState('');             // which claim is in flight

    const load = useCallback(async () => {
        try {
            setStatus(await window.api.rewards.status());
            setLoadError('');
        } catch (err) {
            setLoadError(err.message || 'Could not load your rewards.');
        }
    }, []);

    // Load on open, and again when a session finishes (progress and boosters change)
    useEffect(() => { load(); }, [load, rewards.completedSessions, rewards.coins]);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 4500);
        return () => clearTimeout(t);
    }, [notice]);

    // Claim a bonus: the server decides; the screen then refreshes from the server
    const claim = async (kind, label) => {
        setBusy(kind);
        try {
            const r = await window.api.rewards.claim(kind);
            setNotice({ type: 'ok', text: `${label}: +${r.coins} coins` });
            if (rewards.syncWithBackend) await rewards.syncWithBackend();
            await load();
        } catch (err) {
            setNotice({ type: 'error', text: err.message || 'Could not claim that reward.' });
            await load();
        } finally {
            setBusy('');
        }
    };

    const ClaimButton = ({ kind, label }) => {
        const c = status.claims[kind];
        if (c.claimed) return <button type="button" className="pf-btn" disabled>Claimed</button>;
        if (!c.eligible) return <button type="button" className="pf-btn" disabled>Not yet</button>;
        return <button type="button" className="pf-btn pf-btn--primary" disabled={busy === kind} onClick={() => claim(kind, label)}>{busy === kind ? 'Claiming…' : `Claim ${c.coins} coins`}</button>;
    };

    const nextMilestone = status && status.milestones.find(m => !m.reached);

    return (
        <div className="reward-panel mn-panel">
            <h2>Rewards</h2>

            {notice && <div className={`so-notice so-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
            {loadError && <div className="pf-error" role="alert">{loadError} <button type="button" className="pf-btn" onClick={load}>Try again</button></div>}

            <div className="pf-stats">
                <div className="pf-stat"><strong>{rewards.coins}</strong><span>Coins</span></div>
                <div className="pf-stat"><strong>{rewards.streak}</strong><span>Day streak</span></div>
                <div className="pf-stat"><strong>{rewards.housesBuilt}</strong><span>Houses</span></div>
                <div className="pf-stat"><strong>{Math.floor((rewards.totalFocusTime || 0) / 3600)}h</strong><span>Focused</span></div>
            </div>

            {!status && !loadError && <div className="so-empty">Loading your rewards…</div>}

            {status && (
                <>
                    <section className="pf-section">
                        <h3>Today</h3>
                        <div className="rw-card">
                            <div className="rw-card-main"><strong>Daily check-in</strong><span>A thank-you for showing up today</span></div>
                            <ClaimButton kind="daily_login" label="Daily check-in" />
                        </div>
                        <div className="rw-card rw-card--stack">
                            <div className="rw-card-top">
                                <div className="rw-card-main"><strong>Daily goal</strong><span>Finish 5 sessions or study for 2 hours</span></div>
                                <ClaimButton kind="daily_progress" label="Daily goal" />
                            </div>
                            <RwProgress label="Sessions" value={status.progress.today.sessions} target={status.progress.dailyTargets.sessions} unit="" />
                            <RwProgress label="Minutes" value={status.progress.today.minutes} target={status.progress.dailyTargets.minutes} unit=" min" />
                        </div>
                    </section>

                    <section className="pf-section">
                        <h3>This week</h3>
                        <div className="rw-card rw-card--stack">
                            <div className="rw-card-top">
                                <div className="rw-card-main"><strong>Master builder</strong><span>Finish 20 focus sessions this week (resets Monday)</span></div>
                                <ClaimButton kind="weekly_challenge" label="Weekly challenge" />
                            </div>
                            <RwProgress label="Sessions" value={status.progress.week.sessions} target={status.progress.weeklyTarget} unit="" />
                        </div>
                    </section>

                    <section className="pf-section">
                        <h3>Streak milestones</h3>
                        <div className="rw-milestones">
                            {status.milestones.map(m => (
                                <div key={m.days} className={`rw-milestone ${m.reached ? 'is-on' : ''}`}>
                                    <strong>{m.days}</strong><span>days</span><em>+{m.coins}</em>
                                </div>
                            ))}
                        </div>
                        <p className="pf-note">{nextMilestone
                            ? `${nextMilestone.days - status.streak} more day${nextMilestone.days - status.streak === 1 ? '' : 's'} to your next bonus of ${nextMilestone.coins} coins. It is paid automatically when you finish a session.`
                            : 'You have reached every milestone. Legend.'}</p>
                    </section>

                    <section className="pf-section">
                        <h3>Your boosters</h3>
                        <div className="rw-boosters">
                            {RW_BOOSTERS.map(b => (
                                <div key={b.key} className={`rw-booster ${status.boosters[b.key] > 0 ? 'is-on' : ''}`}>
                                    <strong>{status.boosters[b.key]}</strong>
                                    <div><div className="rw-booster-name">{b.name}</div><div className="rw-booster-what">{b.what}</div></div>
                                </div>
                            ))}
                        </div>
                        <p className="pf-note">Boosters are used up automatically. Get more in the shop.</p>
                    </section>
                </>
            )}

            <section className="pf-section">
                <h3>Recent achievements</h3>
                {(rewards.recentAchievements || []).length === 0
                    ? <div className="pf-empty">Finish focus sessions to earn achievements.</div>
                    : (rewards.recentAchievements || []).slice(0, 5).map((a, i) => (
                        <div className="rw-card" key={a.id || i}>
                            <div className="rw-card-main"><strong>{a.name}</strong><span>{a.description}</span></div>
                            <span className="pf-chip">+{a.coinReward} coins</span>
                        </div>
                    ))}
            </section>
        </div>
    );
};

window.RewardPanel = RewardPanel;
