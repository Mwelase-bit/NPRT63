// ProfilePanel.jsx - the student's profile: a live 3D character they can customise,
// their level and stats, achievements, houses built and a downloadable focus report.
//
// Appearance changes update the game state at once. The App saves them to the server a moment
// later (see "saved character" in App.jsx), so the look follows the student to any device.
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Display names for the shop items that unlock character options
const PF_NAMES = {
    default: 'Classic overalls', outfit_architect: 'Architect suit', outfit_wizard: 'Wizard robes', outfit_ninja: 'Ninja gear',
    outfit_knight: 'Knight armour', outfit_astronaut: 'Astronaut suit',
    hardhat: 'Hard hat', cap: 'Cap', none: 'None', hat_tophat: 'Top hat', hat_crown: 'Gold crown', hat_beret: 'Beret', hat_beanie: 'Beanie', hat_helmet: 'Space helmet',
    hammer: 'Hammer', tool_wrench: 'Golden wrench', tool_paintbrush: 'Paintbrush', tool_drill: 'Power drill', tool_wand: 'Enchanted wand'
};
const PF_OUTFITS = ['default', 'outfit_architect', 'outfit_wizard', 'outfit_ninja', 'outfit_knight', 'outfit_astronaut'];
const PF_HATS = ['hardhat', 'cap', 'none', 'hat_tophat', 'hat_crown', 'hat_beret', 'hat_beanie', 'hat_helmet'];
const PF_TOOLS = ['hammer', 'none', 'tool_wrench', 'tool_paintbrush', 'tool_drill', 'tool_wand'];
const PF_FREE = ['default', 'hardhat', 'cap', 'none', 'hammer'];
const PF_FACULTY = { nas: 'Natural & Applied Sciences', edu: 'Education', ems: 'Economic & Management Sciences', hum: 'Humanities' };

const pfTime = (sec) => {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

// A row of colour swatches
const PfSwatches = ({ label, colors, value, onPick }) => (
    <div className="pf-group">
        <div className="pf-label">{label}</div>
        <div className="pf-swatches" role="group" aria-label={label}>
            {colors.map(c => (
                <button key={c} type="button" className={`pf-swatch ${String(value).toLowerCase() === c.toLowerCase() ? 'is-on' : ''}`}
                    style={{ background: c }} aria-label={`${label} ${c}`} aria-pressed={String(value).toLowerCase() === c.toLowerCase()} onClick={() => onPick(c)} />
            ))}
        </div>
    </div>
);

// A row of text options; options can be locked (shop item not bought yet)
const PfChoices = ({ label, options, value, onPick, owned, names }) => (
    <div className="pf-group">
        <div className="pf-label">{label}</div>
        <div className="pf-choices" role="group" aria-label={label}>
            {options.map(o => {
                const locked = owned && !PF_FREE.includes(o) && !owned.includes(o);
                return (
                    <button key={o} type="button" className={`pf-choice ${value === o ? 'is-on' : ''} ${locked ? 'is-locked' : ''}`}
                        aria-pressed={value === o} disabled={locked} title={locked ? 'Buy this in the shop to use it' : ''} onClick={() => onPick(o)}>
                        {locked && <window.FeatherIcon name="lock" size={12} gap={4} />}
                        {(names && names[o]) || PF_NAMES[o] || o.charAt(0).toUpperCase() + o.slice(1)}
                    </button>
                );
            })}
        </div>
    </div>
);

const ProfilePanel = ({ gameState, rewards }) => {
    const c = gameState.builderCustomization || {};
    const look = useMemo(() => window.AvatarFactory.lookFromCustomization(c), [JSON.stringify(c)]);
    const OPT = window.AvatarFactory.OPTIONS;

    const [view, setView] = useState('full');
    const [tab, setTab] = useState('face');
    const [owned, setOwned] = useState(null);              // shop item ids the student owns (null while loading)
    const [syncState, setSyncState] = useState('');        // '' | 'saving' | 'saved' | 'error'
    const [reportError, setReportError] = useState('');
    const lastSavedProfile = useRef(null);

    const set = (key, value) => gameState.updateBuilderCustomization(key, value);

    // Which shop items does the student own? (unlocks outfits, hats and tools below)
    useEffect(() => {
        if (!gameState.token) return;
        window.api.users.getAvatar()
            .then(r => setOwned(Array.isArray(r.owned) ? r.owned : []))
            .catch(() => setOwned([]));          // offline: only the free options are offered
    }, [gameState.token]);

    // The App tells us how saving the look is going
    useEffect(() => {
        const onSync = (e) => setSyncState(e.detail || '');
        window.addEventListener('bh-avatar-sync', onSync);
        return () => window.removeEventListener('bh-avatar-sync', onSync);
    }, []);

    // Name and gender are saved through the profile endpoint, a moment after typing stops
    useEffect(() => {
        if (!gameState.token) return;
        const snapshot = `${c.name || ''}|${c.gender || ''}`;
        if (lastSavedProfile.current === null) { lastSavedProfile.current = snapshot; return; }   // do not save what we just loaded
        if (snapshot === lastSavedProfile.current) return;
        const name = (c.name || '').trim();
        if (name.length < 2) return;                      // too short to save; keep typing
        const timer = setTimeout(async () => {
            try {
                setSyncState('saving');
                await window.api.users.updateProfile({ name, gender: c.gender });
                lastSavedProfile.current = snapshot;
                setSyncState('saved');
            } catch (err) {
                console.error('Failed to save profile', err);
                setSyncState('error');
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [c.name, c.gender, gameState.token]);

    // Level: one level per focused hour; the bar shows progress to the next
    const totalSec = rewards.totalFocusTime || 0;
    const level = Math.floor(totalSec / 3600) + 1;
    const levelPct = Math.round(((totalSec % 3600) / 3600) * 100);
    const houses = gameState.completedHouses || [];
    const houseCounts = houses.reduce((acc, h) => { acc[h.type] = (acc[h.type] || 0) + 1; return acc; }, {});
    const achievements = rewards.allAchievements || [];
    const unlockedCount = achievements.filter(a => a.unlocked).length;

    // A real, downloadable focus report (replaces the old pop-up that only claimed to save one)
    const downloadReport = () => {
        try {
            setReportError('');
            const lines = [
                'BUILDHAUS focus report',
                `Generated: ${new Date().toLocaleString()}`,
                '',
                `Student: ${c.name || 'Student'}`,
                `Faculty: ${PF_FACULTY[gameState.user && gameState.user.faculty] || (gameState.user && gameState.user.faculty) || 'n/a'}`,
                '',
                `Total focus time: ${pfTime(totalSec)}`,
                `Longest session: ${Math.floor((rewards.longestSession || 0) / 60)} minutes`,
                `Average session: ${Math.floor((rewards.averageSession || 0) / 60)} minutes`,
                `Success rate: ${rewards.successRate}%`,
                `Current streak: ${rewards.streak} days`,
                `Houses built: ${houses.length}`,
                `Achievements: ${unlockedCount} of ${achievements.length}`,
                '',
                'Unlocked achievements:',
                ...achievements.filter(a => a.unlocked).map(a => `  - ${a.name}: ${a.description}`)
            ];
            const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `buildhaus-focus-report-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Report failed', err);
            setReportError('Could not create the report. Please try again.');
        }
    };

    const tabs = [{ id: 'face', label: 'Face' }, { id: 'hair', label: 'Hair' }, { id: 'outfit', label: 'Outfit' }, { id: 'gear', label: 'Hat & tool' }];
    const stat = (value, label) => <div className="pf-stat"><strong>{value}</strong><span>{label}</span></div>;

    return (
        <div className="profile-panel pf-panel">
            <div className="pf-top">
                <h2>Profile</h2>
                <button type="button" className="pf-btn pf-btn--danger" onClick={() => gameState.logout()}>
                    <window.FeatherIcon name="log-out" size={14} gap={6} /> Log out
                </button>
            </div>

            {/* Hero: the character and who they are */}
            <div className="pf-hero">
                <div className="pf-stage">
                    <window.CharacterPreview look={look} view={view} />
                    <div className="pf-stage-bar" role="group" aria-label="Camera">
                        <button type="button" className={`pf-pill ${view === 'full' ? 'is-on' : ''}`} onClick={() => setView('full')}>Full body</button>
                        <button type="button" className={`pf-pill ${view === 'face' ? 'is-on' : ''}`} onClick={() => setView('face')}>Face</button>
                    </div>
                    <div className="pf-stage-hint">Drag to turn</div>
                </div>

                <div className="pf-info">
                    <label className="pf-label" htmlFor="pf-name">Builder name</label>
                    <input id="pf-name" className="pf-input" type="text" maxLength={40} value={c.name || ''} placeholder="Your name"
                        onChange={(e) => set('name', e.target.value)} />
                    <div className="pf-sub">{PF_FACULTY[gameState.user && gameState.user.faculty] || ''}</div>

                    <div className="pf-level">
                        <div className="pf-level-row"><strong>Level {level}</strong><span>{pfTime(totalSec)} focused</span></div>
                        <div className="pf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={levelPct} aria-label="Progress to the next level"><span style={{ width: `${levelPct}%` }} /></div>
                        <div className="pf-sub">{Math.ceil((3600 - (totalSec % 3600)) / 60)} min of focus to level {level + 1}</div>
                    </div>

                    <div className="pf-stats">
                        {stat(rewards.streak, 'Streak')}
                        {stat(houses.length, 'Houses')}
                        {stat(rewards.coins, 'Coins')}
                        {stat(`${unlockedCount}/${achievements.length}`, 'Badges')}
                    </div>
                    <div className={`pf-sync ${syncState}`} aria-live="polite">
                        {syncState === 'saving' && 'Saving…'}
                        {syncState === 'saved' && 'Saved'}
                        {syncState === 'error' && 'Could not save. Check your connection; your changes are kept on this device.'}
                    </div>
                </div>
            </div>

            {/* Customise */}
            <section className="pf-section">
                <h3>Customise your builder</h3>
                <div className="pf-tabs" role="tablist">
                    {tabs.map(t => (
                        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`pf-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => { setTab(t.id); setView(t.id === 'outfit' || t.id === 'gear' ? 'full' : 'face'); }}>{t.label}</button>
                    ))}
                </div>

                {tab === 'face' && (
                    <div>
                        <PfChoices label="Build" options={['male', 'female', 'other']} value={look.gender} onPick={(v) => set('gender', v)}
                            names={{ male: 'Broad', female: 'Slim', other: 'Neutral' }} />
                        <PfSwatches label="Skin" colors={OPT.skinColors} value={look.skinColor} onPick={(v) => set('skinColor', v)} />
                        <PfSwatches label="Eyes" colors={OPT.eyeColors} value={look.eyeColor} onPick={(v) => set('eyeColor', v)} />
                        <PfChoices label="Expression" options={OPT.mouths} value={look.mouth} onPick={(v) => set('mouth', v)} />
                        <PfChoices label="Facial hair" options={OPT.facialHair} value={look.facialHair} onPick={(v) => set('facialHair', v)} />
                        <PfChoices label="Glasses" options={OPT.glasses} value={look.glasses} onPick={(v) => set('glasses', v)} />
                    </div>
                )}
                {tab === 'hair' && (
                    <div>
                        <PfChoices label="Style" options={OPT.hairStyles} value={look.hairStyle} onPick={(v) => set('hairStyle', v)} />
                        <PfSwatches label="Colour" colors={OPT.hairColors} value={look.hairColor} onPick={(v) => set('hairColor', v)} />
                    </div>
                )}
                {tab === 'outfit' && (
                    <div>
                        <PfChoices label="Outfit" options={PF_OUTFITS} value={look.outfit} owned={owned || []} onPick={(v) => set('outfit', v)} />
                        {look.outfit === 'default' && <PfSwatches label="Overalls colour" colors={OPT.outfitColors} value={look.overallColor} onPick={(v) => set('overallColor', v)} />}
                        {owned && PF_OUTFITS.some(o => !PF_FREE.includes(o) && !owned.includes(o)) && <p className="pf-note">Locked outfits are sold in the shop.</p>}
                    </div>
                )}
                {tab === 'gear' && (
                    <div>
                        <PfChoices label="Hat" options={PF_HATS} value={look.hat} owned={owned || []} onPick={(v) => set('hat', v)} />
                        {(look.hat === 'hardhat' || look.hat === 'cap') && <PfSwatches label="Hat colour" colors={OPT.hatColors} value={look.hatColor} onPick={(v) => set('hatColor', v)} />}
                        <PfChoices label="Tool" options={PF_TOOLS} value={look.tool} owned={owned || []} onPick={(v) => set('tool', v)} />
                    </div>
                )}
            </section>

            {/* Houses */}
            <section className="pf-section">
                <h3>Houses you have built <span className="pf-count">{houses.length}</span></h3>
                {houses.length === 0
                    ? <div className="pf-empty">Finish a focus session to build your first house.</div>
                    : <div className="pf-chips">{Object.entries(houseCounts).map(([type, n]) => <span className="pf-chip" key={type}>{n} × {type}</span>)}</div>}
            </section>

            {/* Achievements */}
            <section className="pf-section">
                <h3>Achievements <span className="pf-count">{unlockedCount}/{achievements.length}</span></h3>
                <div className="pf-badges">
                    {achievements.map((a, i) => (
                        <div key={a.id || i} className={`pf-badge ${a.unlocked ? 'is-on' : ''}`} title={a.unlocked ? `${a.name}: ${a.description}` : 'Keep building to unlock this'}>
                            <window.FeatherIcon name={a.unlocked ? (a.icon || 'award') : 'lock'} size={18} gap={0} />
                            <span>{a.unlocked ? a.name : '???'}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Statistics + report */}
            <section className="pf-section">
                <div className="pf-section-head">
                    <h3>Focus statistics</h3>
                    <button type="button" className="pf-btn" onClick={downloadReport}><window.FeatherIcon name="download" size={14} gap={6} /> Download report</button>
                </div>
                {reportError && <div className="pf-error" role="alert">{reportError}</div>}
                <div className="pf-stats pf-stats--wide">
                    {stat(pfTime(totalSec), 'Total focus')}
                    {stat(`${Math.floor((rewards.longestSession || 0) / 60)} min`, 'Longest')}
                    {stat(`${Math.floor((rewards.averageSession || 0) / 60)} min`, 'Average')}
                    {stat(`${rewards.successRate}%`, 'Success rate')}
                </div>
            </section>
        </div>
    );
};

window.ProfilePanel = ProfilePanel;
