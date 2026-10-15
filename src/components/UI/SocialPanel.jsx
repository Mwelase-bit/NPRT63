// SocialPanel.jsx - friends, class groups and shared study rooms.
// Everything is shared with an invite code, which also becomes a link and a QR
// code. A friend scans or opens it, sees what it is, and joins in one tap.
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const SO_FACULTY = { nas: 'Natural & Applied Sciences', edu: 'Education', ems: 'Economic & Management Sciences', hum: 'Humanities' };
const SO_STATUS = {
    joined: { label: 'Waiting', cls: 'wait' },
    focusing: { label: 'Focusing', cls: 'live' },
    completed: { label: 'Finished', cls: 'done' },
    interrupted: { label: 'Left early', cls: 'bad' }
};
const SO_HUES = [210, 160, 35, 280, 340, 190, 100];

const soTime = (sec) => {
    sec = Math.round(sec || 0);
    if (sec <= 0) return '0m';
    if (sec < 60) return `${sec}s`;
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
const soInviteLink = (code) => `${window.location.origin}/?invite=${encodeURIComponent(code)}`;

// A pasted invite can be a bare code or a whole link
const soParseInvite = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    const m = s.match(/[?&]invite=([^&#\s]+)/i);
    return m ? decodeURIComponent(m[1]) : s;
};

const soCopy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
        ta.remove();
        return ok;
    }
};

// Two-step confirm for destructive buttons: first tap arms, second tap does it
const useArm = () => {
    const [armed, setArmed] = useState(null);
    useEffect(() => { if (armed === null) return; const t = setTimeout(() => setArmed(null), 3500); return () => clearTimeout(t); }, [armed]);
    return [armed, setArmed];
};

const SoIcon = ({ name, size = 16 }) => <window.FeatherIcon name={name} size={size} gap={0} />;

const SoAvatar = ({ name }) => {
    const hue = SO_HUES[(String(name || '?').charCodeAt(0) || 0) % SO_HUES.length];
    return <span className="so-avatar" style={{ background: `hsl(${hue} 55% 38%)` }} aria-hidden="true">{String(name || '?').trim().charAt(0).toUpperCase()}</span>;
};

// ── QR code (drawn in the browser from the bundled generator) ───────────────
const QrCode = ({ text, size = 148, label }) => {
    const svg = useMemo(() => {
        try {
            const qr = window.qrcode(0, 'M');
            qr.addData(text);
            qr.make();
            return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        } catch (e) { return ''; }
    }, [text]);
    return <div className="so-qr" style={{ width: size, height: size }} role="img" aria-label={label || 'QR code'} dangerouslySetInnerHTML={{ __html: svg }} />;
};

// ── Share card: code + QR + link, used for friends, groups and rooms ────────
const ShareCard = ({ title, subtitle, code, notify }) => {
    const link = soInviteLink(code);
    const copy = async (text, ok) => {
        const done = await soCopy(text);
        notify(done ? ok : 'Could not copy. Select the text and copy it by hand.', done ? 'ok' : 'error');
    };
    const share = async () => {
        if (navigator.share) { try { await navigator.share({ title, text: subtitle, url: link }); } catch (e) { /* cancelled */ } }
        else copy(link, 'Invite link copied');
    };
    return (
        <div className="so-share">
            <QrCode text={link} label={`QR code for ${title}`} />
            <div className="so-share-body">
                <div className="so-share-title">{title}</div>
                <div className="so-share-sub">{subtitle}</div>
                <div className="so-code" aria-label="Invite code">{code}</div>
                <div className="so-actions">
                    <button type="button" className="so-btn" onClick={() => copy(link, 'Invite link copied')}><SoIcon name="link" size={14} /> Copy link</button>
                    <button type="button" className="so-btn" onClick={() => copy(code, 'Code copied')}><SoIcon name="copy" size={14} /> Copy code</button>
                    {typeof navigator !== 'undefined' && navigator.share && (
                        <button type="button" className="so-btn" onClick={share}><SoIcon name="share-2" size={14} /> Share</button>
                    )}
                </div>
                <div className="so-hint">Scan the QR code or open the link on any device.</div>
            </div>
        </div>
    );
};

// ── Invite dialog: what does this code open? Confirm, then join ─────────────
const InviteDialog = ({ code, onClose, onDone }) => {
    const [info, setInfo] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        window.api.social.invite(code)
            .then(r => { if (alive) setInfo(r); })
            .catch(e => { if (alive) setError(e.message || 'That invite is not valid.'); });
        return () => { alive = false; };
    }, [code]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const act = async () => {
        setBusy(true);
        setError('');
        try {
            const S = window.api.social;
            if (info.kind === 'friend') {
                const r = await S.requestFriend(info.code);
                onDone({ tab: 'friends', message: r.status === 'accepted' ? `You and ${info.name} are now friends.` : `Friend request sent to ${info.name}.` });
            } else if (info.kind === 'group') {
                const r = await S.joinGroup(info.code);
                onDone({ tab: 'groups', id: r.group.id, message: r.alreadyMember ? 'You are already in this group.' : `You joined ${r.group.name}.` });
            } else {
                const r = await S.joinRoom(info.code);
                onDone({ tab: 'rooms', id: r.room.id, message: r.alreadyMember ? 'You are already in this room.' : `You joined ${r.room.title}.` });
            }
        } catch (e) { setError(e.message || 'Something went wrong.'); setBusy(false); }
    };

    let heading = 'Invite', body = null, action = null, disabled = false;
    if (info) {
        if (info.kind === 'friend') {
            heading = info.isMe ? 'This is your own code' : `${info.name} wants to study with you`;
            body = `${SO_FACULTY[info.faculty] || ''}`;
            action = info.relation === 'incoming' ? 'Accept friend request' : 'Send friend request';
            if (info.isMe) { action = 'Nothing to do'; disabled = true; }
            if (info.relation === 'friends') { action = 'You are already friends'; disabled = true; }
            if (info.relation === 'requested') { action = 'Request already sent'; disabled = true; }
        } else if (info.kind === 'group') {
            heading = `Join ${info.name}`;
            body = `Class group by ${info.ownerName} · ${info.memberCount} member${info.memberCount === 1 ? '' : 's'}`;
            action = info.alreadyMember ? 'Open group' : 'Join group';
        } else {
            heading = info.title;
            body = `Study room hosted by ${info.hostName} · ${info.durationMin >= 60 ? `${Math.floor(info.durationMin / 60)}h ${info.durationMin % 60 ? info.durationMin % 60 + 'm' : ''}`.trim() : info.durationMin + ' min'} · ${info.memberCount} in the room`;
            action = !info.live ? 'This room has ended' : info.alreadyMember ? 'Open room' : 'Join room';
            disabled = !info.live;
        }
    }

    return ReactDOM.createPortal(
        <div className="study-dialog-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="study-dialog so-invite" role="dialog" aria-modal="true" aria-label="Invite">
                <div className="study-dialog-head">
                    <div>
                        <h3>{info ? heading : error ? 'Invite problem' : 'Checking invite…'}</h3>
                        {info && <p>{body}</p>}
                        {!info && !error && <p>One moment.</p>}
                    </div>
                    <button type="button" className="study-dialog-x" aria-label="Close" onClick={onClose}>&times;</button>
                </div>
                {error && <div className="so-error" role="alert">{error}</div>}
                <div className="study-dialog-actions" style={{ marginTop: 14 }}>
                    <button type="button" className="study-dialog-cancel" onClick={onClose}>Close</button>
                    {info && <button type="button" className="study-dialog-add" disabled={disabled || busy} onClick={act}>{busy ? 'Working…' : action}</button>}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── Friends tab ──────────────────────────────────────────────────────────────
const FriendsTab = ({ me, friends, run, notify }) => {
    const [armed, setArmed] = useArm();
    const S = window.api.social;
    if (!friends) return <div className="so-empty">Loading friends…</div>;
    return (
        <div>
            {me && <ShareCard title="Your friend code" subtitle={`Anyone with this can send you a friend request, ${me.name.split(' ')[0]}.`} code={me.code} notify={notify} />}

            {friends.incoming.length > 0 && (
                <section className="so-section">
                    <h3>Friend requests <span className="so-count">{friends.incoming.length}</span></h3>
                    {friends.incoming.map(f => (
                        <div className="so-row" key={f.id}>
                            <SoAvatar name={f.name} />
                            <div className="so-row-main"><div className="so-name">{f.name}</div><div className="so-meta">{SO_FACULTY[f.faculty]}</div></div>
                            <button type="button" className="so-btn so-btn--primary" onClick={() => run(() => S.acceptFriend(f.id), `You and ${f.name} are friends.`)}>Accept</button>
                            <button type="button" className="so-btn" onClick={() => run(() => S.declineFriend(f.id))}>Decline</button>
                        </div>
                    ))}
                </section>
            )}

            <section className="so-section">
                <h3>Friends <span className="so-count">{friends.friends.length}</span></h3>
                {friends.friends.length === 0 && (
                    <div className="so-empty-card">No friends yet. Share your code or QR code above, or paste a friend's code at the top of this page.</div>
                )}
                {friends.friends.map((f, i) => (
                    <div className="so-row" key={f.id}>
                        <span className="so-rank">{i + 1}</span>
                        <SoAvatar name={f.name} />
                        <div className="so-row-main">
                            <div className="so-name">{f.name}</div>
                            <div className="so-meta">{SO_FACULTY[f.faculty]}{f.streak > 0 ? ` · ${f.streak}-day streak` : ''}</div>
                        </div>
                        <div className="so-stat"><strong>{soTime(f.weeklySeconds)}</strong><span>this week</span></div>
                        <button type="button" className="so-btn so-btn--quiet" onClick={() => armed === `f${f.id}` ? run(() => S.removeFriend(f.id), `${f.name} removed.`) : setArmed(`f${f.id}`)}>
                            {armed === `f${f.id}` ? 'Tap to confirm' : 'Remove'}
                        </button>
                    </div>
                ))}
            </section>

            {friends.outgoing.length > 0 && (
                <section className="so-section">
                    <h3>Waiting for a reply</h3>
                    {friends.outgoing.map(f => (
                        <div className="so-row" key={f.id}>
                            <SoAvatar name={f.name} />
                            <div className="so-row-main"><div className="so-name">{f.name}</div><div className="so-meta">Request sent</div></div>
                            <button type="button" className="so-btn so-btn--quiet" onClick={() => run(() => S.removeFriend(f.id), 'Request cancelled.')}>Cancel</button>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
};

// ── Group detail ─────────────────────────────────────────────────────────────
const GroupDetail = ({ id, onBack, onNewRoom, run, notify, refreshAll }) => {
    const [d, setD] = useState(null);
    const [err, setErr] = useState('');
    const [armed, setArmed] = useArm();
    const S = window.api.social;
    const load = useCallback(async () => {
        try { setD(await S.group(id)); setErr(''); } catch (e) { setErr(e.message || 'Could not load this group.'); }
    }, [id]);
    useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

    if (err) return <div><button type="button" className="so-back" onClick={onBack}>&larr; Groups</button><div className="so-error">{err}</div></div>;
    if (!d) return <div className="so-empty">Loading group…</div>;
    const g = d.group, owner = g.role === 'owner';
    const after = async () => { await load(); await refreshAll(); };
    return (
        <div>
            <button type="button" className="so-back" onClick={onBack}>&larr; Groups</button>
            <div className="so-detail-head">
                <div><h2>{g.name}</h2><div className="so-meta">{g.memberCount} member{g.memberCount === 1 ? '' : 's'} · {soTime(d.totalWeeklySeconds)} focused together this week</div></div>
                <button type="button" className="so-btn so-btn--primary" onClick={() => onNewRoom(g.id)}>Start a study room</button>
            </div>

            <ShareCard title="Invite classmates" subtitle="Anyone with this code, link or QR can join the group." code={g.inviteCode} notify={notify} />

            <section className="so-section">
                <h3>This week</h3>
                {d.members.map(m => (
                    <div className={`so-row ${m.isMe ? 'is-me' : ''}`} key={m.id}>
                        <span className="so-rank">{m.rank}</span>
                        <SoAvatar name={m.name} />
                        <div className="so-row-main">
                            <div className="so-name">{m.name}{m.isMe ? ' (you)' : ''}{m.role === 'owner' ? <span className="so-tag">Owner</span> : null}</div>
                            <div className="so-meta">{SO_FACULTY[m.faculty]}</div>
                        </div>
                        <div className="so-stat"><strong>{soTime(m.weeklySeconds)}</strong><span>focused</span></div>
                        {owner && !m.isMe && (
                            <button type="button" className="so-btn so-btn--quiet" aria-label={`Remove ${m.name}`}
                                onClick={() => armed === `m${m.id}` ? run(() => S.removeGroupMember(g.id, m.id), `${m.name} removed.`, after) : setArmed(`m${m.id}`)}>
                                {armed === `m${m.id}` ? 'Tap to confirm' : 'Remove'}
                            </button>
                        )}
                    </div>
                ))}
            </section>

            <div className="so-actions so-actions--end">
                {owner && <button type="button" className="so-btn" onClick={() => armed === 'reset' ? run(() => S.resetGroupCode(g.id), 'New invite code created. The old one no longer works.', after) : setArmed('reset')}>{armed === 'reset' ? 'Tap to confirm' : 'Reset invite code'}</button>}
                <button type="button" className="so-btn so-btn--danger" onClick={() => armed === 'leave' ? run(() => S.leaveGroup(g.id), 'You left the group.', onBack) : setArmed('leave')}>{armed === 'leave' ? 'Tap to confirm' : 'Leave group'}</button>
                {owner && <button type="button" className="so-btn so-btn--danger" onClick={() => armed === 'del' ? run(() => S.deleteGroup(g.id), 'Group deleted.', onBack) : setArmed('del')}>{armed === 'del' ? 'Tap to confirm' : 'Delete group'}</button>}
            </div>
        </div>
    );
};

// ── Groups tab ───────────────────────────────────────────────────────────────
const GroupsTab = ({ groups, selected, setSelected, onNewRoom, run, notify, refreshAll }) => {
    const [name, setName] = useState('');
    const S = window.api.social;
    if (selected) return <GroupDetail id={selected} onBack={() => setSelected(null)} onNewRoom={onNewRoom} run={run} notify={notify} refreshAll={refreshAll} />;
    if (!groups) return <div className="so-empty">Loading groups…</div>;
    return (
        <div>
            <form className="so-form" onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length < 2) return notify('Give the group a name of at least 2 letters.', 'error');
                run(() => S.createGroup(name), 'Group created.', (r) => { setName(''); setSelected(r.group.id); });
            }}>
                <input className="so-input" type="text" value={name} maxLength={40} placeholder="New class group, e.g. NPRT630 Class of 2026" onChange={(e) => setName(e.target.value)} aria-label="Group name" />
                <button type="submit" className="so-btn so-btn--primary">Create group</button>
            </form>
            {groups.length === 0 && <div className="so-empty-card">No groups yet. Create one for your class, then share its code or QR code. To join one, paste its code at the top of this page.</div>}
            {groups.map(g => (
                <button type="button" className="so-row so-row--button" key={g.id} onClick={() => setSelected(g.id)}>
                    <SoAvatar name={g.name} />
                    <div className="so-row-main"><div className="so-name">{g.name}</div><div className="so-meta">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}{g.role === 'owner' ? ' · you own this group' : ''}</div></div>
                    <SoIcon name="chevron-right" size={16} />
                </button>
            ))}
        </div>
    );
};

// ── Room detail ──────────────────────────────────────────────────────────────
const RoomDetail = ({ id, onBack, onStartRoom, activeRoomId, run, notify, refreshAll }) => {
    const [d, setD] = useState(null);
    const [err, setErr] = useState('');
    const [armed, setArmed] = useArm();
    const S = window.api.social;
    const load = useCallback(async () => {
        try { setD(await S.room(id)); setErr(''); } catch (e) { setErr(e.message || 'Could not load this room.'); }
    }, [id]);
    useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

    if (err) return <div><button type="button" className="so-back" onClick={onBack}>&larr; Study rooms</button><div className="so-error">{err}</div></div>;
    if (!d) return <div className="so-empty">Loading room…</div>;
    const r = d.room, live = r.status === 'open', host = r.isHost;
    const inSession = activeRoomId === r.id;
    const dur = r.durationMin >= 60 ? `${Math.floor(r.durationMin / 60)}h${r.durationMin % 60 ? ' ' + (r.durationMin % 60) + 'm' : ''}` : `${r.durationMin} min`;
    return (
        <div>
            <button type="button" className="so-back" onClick={onBack}>&larr; Study rooms</button>
            <div className="so-detail-head">
                <div>
                    <h2>{r.title}</h2>
                    <div className="so-meta">{dur} session · hosted by {r.hostName}{r.groupName ? ` · ${r.groupName}` : ''}</div>
                </div>
                {live && (
                    <button type="button" className="so-btn so-btn--primary" disabled={inSession || r.myStatus === 'focusing'} onClick={() => onStartRoom(r)}>
                        {inSession || r.myStatus === 'focusing' ? 'You are focusing' : 'Start my session'}
                    </button>
                )}
            </div>
            {!live && <div className="so-error">This room has ended.</div>}
            {live && <p className="so-hint so-hint--lead">Everyone starts their own timer. You will all see who is focusing, who has finished and who left early.</p>}

            <section className="so-section">
                <h3>In this room <span className="so-count">{d.members.length}</span>
                    <span className="so-summary">{d.summary.focusing} focusing · {d.summary.completed} finished</span></h3>
                {d.members.map(m => {
                    const st = SO_STATUS[m.status] || SO_STATUS.joined;
                    return (
                        <div className={`so-row ${m.isMe ? 'is-me' : ''}`} key={m.id}>
                            <SoAvatar name={m.name} />
                            <div className="so-row-main"><div className="so-name">{m.name}{m.isMe ? ' (you)' : ''}{m.isHost ? <span className="so-tag">Host</span> : null}</div><div className="so-meta">{SO_FACULTY[m.faculty]}</div></div>
                            <span className={`so-status so-status--${st.cls}`}>{st.label}</span>
                        </div>
                    );
                })}
            </section>

            {live && <ShareCard title="Invite to this room" subtitle="Friends can join with this code, link or QR code." code={r.inviteCode} notify={notify} />}

            <div className="so-actions so-actions--end">
                {host
                    ? <button type="button" className="so-btn so-btn--danger" onClick={() => armed === 'close' ? run(() => S.closeRoom(r.id), 'Room ended.', onBack) : setArmed('close')}>{armed === 'close' ? 'Tap to confirm' : 'End room for everyone'}</button>
                    : <button type="button" className="so-btn so-btn--danger" onClick={() => armed === 'leave' ? run(() => S.leaveRoom(r.id), 'You left the room.', onBack) : setArmed('leave')}>{armed === 'leave' ? 'Tap to confirm' : 'Leave room'}</button>}
            </div>
        </div>
    );
};

// ── Rooms tab ────────────────────────────────────────────────────────────────
const RoomsTab = ({ rooms, groups, selected, setSelected, presetGroupId, onStartRoom, activeRoomId, run, notify, refreshAll }) => {
    const S = window.api.social;
    const [title, setTitle] = useState('');
    const [minutes, setMinutes] = useState(45);
    const [groupId, setGroupId] = useState(presetGroupId || '');
    useEffect(() => { if (presetGroupId) setGroupId(String(presetGroupId)); }, [presetGroupId]);

    if (selected) return <RoomDetail id={selected} onBack={() => setSelected(null)} onStartRoom={onStartRoom} activeRoomId={activeRoomId} run={run} notify={notify} refreshAll={refreshAll} />;
    if (!rooms) return <div className="so-empty">Loading rooms…</div>;
    const dur = (m) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`;
    return (
        <div>
            <form className="so-form so-form--stack" onSubmit={(e) => {
                e.preventDefault();
                const m = parseInt(minutes, 10);
                if (!(m >= 5 && m <= 720)) return notify('Choose a length between 5 minutes and 12 hours.', 'error');
                run(() => S.createRoom({ durationMin: m, ...(title.trim() ? { title } : {}), ...(groupId ? { groupId: parseInt(groupId, 10) } : {}) }),
                    'Study room created. Share the code to bring friends in.', (r) => { setTitle(''); setSelected(r.room.id); });
            }}>
                <div className="so-form-title">Start a study room</div>
                <input className="so-input" type="text" value={title} maxLength={60} placeholder="Room name (optional)" onChange={(e) => setTitle(e.target.value)} aria-label="Room name" />
                <div className="so-chips" role="group" aria-label="Session length">
                    {[25, 45, 60, 90, 120].map(m => (
                        <button type="button" key={m} className={`so-chip ${parseInt(minutes, 10) === m ? 'is-on' : ''}`} onClick={() => setMinutes(m)}>{dur(m)}</button>
                    ))}
                    <label className="so-chip-input"><input type="number" min="5" max="720" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" /> min</label>
                </div>
                {groups && groups.length > 0 && (
                    <select className="so-input" value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Share with a group">
                        <option value="">Friends only (share the code)</option>
                        {groups.map(g => <option key={g.id} value={g.id}>Open to group: {g.name}</option>)}
                    </select>
                )}
                <button type="submit" className="so-btn so-btn--primary so-btn--wide">Create room</button>
            </form>

            {rooms.joinable.length > 0 && (
                <section className="so-section">
                    <h3>Join in <span className="so-count">{rooms.joinable.length}</span></h3>
                    {rooms.joinable.map(r => (
                        <div className="so-row" key={r.id}>
                            <SoAvatar name={r.hostName} />
                            <div className="so-row-main"><div className="so-name">{r.title}</div><div className="so-meta">{r.hostName} · {dur(r.durationMin)} · {r.memberCount} in · {r.via === 'friend' ? 'your friend' : r.groupName}</div></div>
                            <button type="button" className="so-btn so-btn--primary" onClick={() => run(() => S.joinRoomById(r.id), `You joined ${r.title}.`, () => setSelected(r.id))}>Join</button>
                        </div>
                    ))}
                </section>
            )}

            <section className="so-section">
                <h3>Your rooms <span className="so-count">{rooms.rooms.length}</span></h3>
                {rooms.rooms.length === 0 && <div className="so-empty-card">No active rooms. Create one above, or paste a room code at the top of this page.</div>}
                {rooms.rooms.map(r => (
                    <button type="button" className="so-row so-row--button" key={r.id} onClick={() => setSelected(r.id)}>
                        <SoAvatar name={r.title} />
                        <div className="so-row-main"><div className="so-name">{r.title}</div><div className="so-meta">{dur(r.durationMin)} · {r.memberCount} in the room{r.isHost ? ' · you are the host' : ''}</div></div>
                        <span className={`so-status so-status--${(SO_STATUS[r.myStatus] || SO_STATUS.joined).cls}`}>{(SO_STATUS[r.myStatus] || SO_STATUS.joined).label}</span>
                    </button>
                ))}
            </section>
        </div>
    );
};

// ── The panel ────────────────────────────────────────────────────────────────
const SocialPanel = ({ gameState, onStartRoom, activeRoomId, initialView, onViewConsumed }) => {
    const token = gameState && gameState.token;
    const [tab, setTab] = useState('friends');
    const [me, setMe] = useState(null);
    const [friends, setFriends] = useState(null);
    const [groups, setGroups] = useState(null);
    const [rooms, setRooms] = useState(null);
    const [selGroup, setSelGroup] = useState(null);
    const [selRoom, setSelRoom] = useState(null);
    const [presetGroup, setPresetGroup] = useState(null);
    const [notice, setNotice] = useState(null);
    const [codeInput, setCodeInput] = useState('');
    const [dialogCode, setDialogCode] = useState(null);
    const noticeTimer = useRef(null);
    const S = window.api && window.api.social;

    const notify = useCallback((text, type) => {
        setNotice({ text, type: type || 'ok' });
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 4500);
    }, []);

    const refreshAll = useCallback(async () => {
        if (!token) return;
        const safe = (p, set) => p.then(set).catch(() => { });
        await Promise.all([
            safe(S.me(), setMe), safe(S.friends(), setFriends), safe(S.groups(), r => setGroups(r.groups)), safe(S.rooms(), setRooms)
        ]);
    }, [token]);

    useEffect(() => {
        refreshAll();
        const t = setInterval(() => { if (document.visibilityState === 'visible') refreshAll(); }, 10000);
        return () => clearInterval(t);
    }, [refreshAll]);

    // An invite link or QR scan sends the student straight to the right place
    useEffect(() => {
        if (!initialView) return;
        setTab(initialView.tab || 'friends');
        if (initialView.tab === 'groups') setSelGroup(initialView.id || null);
        if (initialView.tab === 'rooms') setSelRoom(initialView.id || null);
        if (initialView.message) notify(initialView.message);
        refreshAll();
        if (onViewConsumed) onViewConsumed();
    }, [initialView]);

    const run = useCallback(async (fn, okMsg, after) => {
        try {
            const r = await fn();
            if (okMsg) notify(okMsg);
            await refreshAll();
            if (after) await after(r);
        } catch (e) { notify(e.message || 'Something went wrong.', 'error'); }
    }, [notify, refreshAll]);

    if (!token) return <div className="social-panel"><div className="so-empty">Sign in to add friends and join study groups.</div></div>;

    const tabs = [
        { id: 'friends', label: 'Friends', badge: friends && friends.incoming.length },
        { id: 'groups', label: 'Groups', badge: 0 },
        { id: 'rooms', label: 'Study rooms', badge: rooms && rooms.joinable.length }
    ];

    return (
        <div className="social-panel">
            <div className="so-header">
                <div>
                    <h2>Study together</h2>
                    <p className="so-subtitle">Add friends, join your class group and focus side by side.</p>
                </div>
            </div>

            <form className="so-form so-codebox" onSubmit={(e) => { e.preventDefault(); const c = soParseInvite(codeInput); if (c) setDialogCode(c); }}>
                <input className="so-input" type="text" value={codeInput} placeholder="Have a code or link? Paste it here" onChange={(e) => setCodeInput(e.target.value)} aria-label="Invite code or link" />
                <button type="submit" className="so-btn so-btn--primary" disabled={!codeInput.trim()}>Open</button>
            </form>

            {notice && <div className={`so-notice so-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}

            <div className="so-tabs" role="tablist">
                {tabs.map(t => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} className={`so-tab ${tab === t.id ? 'active' : ''}`}
                        onClick={() => { setTab(t.id); if (t.id === 'groups') setSelGroup(null); if (t.id === 'rooms') setSelRoom(null); }}>
                        {t.label}{t.badge > 0 && <span className="so-badge">{t.badge}</span>}
                    </button>
                ))}
            </div>

            <div className="so-body">
                {tab === 'friends' && <FriendsTab me={me} friends={friends} run={run} notify={notify} />}
                {tab === 'groups' && <GroupsTab groups={groups} selected={selGroup} setSelected={setSelGroup}
                    onNewRoom={(gid) => { setPresetGroup(gid); setSelRoom(null); setTab('rooms'); }} run={run} notify={notify} refreshAll={refreshAll} />}
                {tab === 'rooms' && <RoomsTab rooms={rooms} groups={groups} selected={selRoom} setSelected={setSelRoom} presetGroupId={presetGroup}
                    onStartRoom={onStartRoom} activeRoomId={activeRoomId} run={run} notify={notify} refreshAll={refreshAll} />}
            </div>

            {dialogCode && (
                <InviteDialog code={dialogCode} onClose={() => setDialogCode(null)}
                    onDone={(v) => { setDialogCode(null); setCodeInput(''); setTab(v.tab); setSelGroup(v.tab === 'groups' ? v.id : null); setSelRoom(v.tab === 'rooms' ? v.id : null); notify(v.message); refreshAll(); }} />
            )}
        </div>
    );
};

window.SocialPanel = SocialPanel;
window.InviteDialog = InviteDialog;
