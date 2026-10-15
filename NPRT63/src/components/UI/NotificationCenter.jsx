// NotificationCenter.jsx - the bell in the corner.
//
// Shows everything the student has been told (friend requests, friends starting sessions,
// study room activity, streaks, achievements), with an unread badge. A quiet toast appears
// when something new arrives. The menu also holds the push switch and the per-category switches.
//
// New notifications arrive three ways: a push message handed over by the service worker,
// a refresh every 25 seconds, and a refresh whenever the student returns to the page.
const { useState, useEffect, useRef, useCallback } = React;

// "just now", "5 min ago", "3 h ago", "2 d ago"
const ncAgo = (value) => {
    const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? value : String(value).replace(' ', 'T') + 'Z').getTime();
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
};

const NotificationBell = ({ gameState, onNavigate }) => {
    const token = gameState && gameState.token;
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [prefs, setPrefs] = useState([]);
    const [pushState, setPushState] = useState('off');   // see PushClient.status()
    const [message, setMessage] = useState('');          // inline error / info inside the menu
    const [toast, setToast] = useState(null);
    const [busy, setBusy] = useState(false);
    const knownIds = useRef(null);                       // ids already seen, so only truly new ones raise a toast
    const toastTimer = useRef(null);
    const rootRef = useRef(null);

    const showToast = useCallback((n) => {
        setToast(n);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 5500);
    }, []);

    // Load the list; any failure leaves the previous list in place and is only logged
    // (a flaky connection must not wipe the bell)
    const refresh = useCallback(async () => {
        if (!token) return;
        try {
            const res = await window.api.notifications.list();
            const list = Array.isArray(res.notifications) ? res.notifications : [];
            if (knownIds.current === null) {
                knownIds.current = new Set(list.map(n => n.id));       // first load: nothing is "new"
            } else {
                const fresh = list.filter(n => !knownIds.current.has(n.id) && !n.read);
                list.forEach(n => knownIds.current.add(n.id));
                if (fresh.length) showToast(fresh[0]);
            }
            setItems(list);
            setUnread(res.unread || 0);
        } catch (err) {
            console.warn('Could not refresh notifications:', err.message);
        }
    }, [token, showToast]);

    const loadSettings = useCallback(async () => {
        try {
            const [p, st] = await Promise.all([window.api.notifications.prefs(), window.PushClient.status()]);
            setPrefs(p.prefs || []);
            setPushState(st);
        } catch (err) {
            setMessage('Could not load your notification settings.');
        }
    }, []);

    // Poll, refresh on return to the page, and hear from the service worker
    useEffect(() => {
        if (!token) return;
        knownIds.current = null;
        refresh();
        window.PushClient.sync();                                        // re-attach this device after sign-in (never prompts)
        const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 25000);
        const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onVisible);
        const onWorker = (event) => {
            if (event.data && event.data.type === 'buildhaus-push') { showToast(event.data.payload); refresh(); }
            if (event.data && event.data.type === 'buildhaus-open' && onNavigate) onNavigate(event.data.link);
        };
        if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', onWorker);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', onWorker);
        };
    }, [token]);

    // Opening the menu loads the settings; Escape or a click outside closes it
    useEffect(() => {
        if (!open) return;
        setMessage('');
        loadSettings();
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
        window.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
        };
    }, [open]);

    if (!token) return null;

    // Run a menu action with one shared busy flag and one place to show its error
    const act = async (fn) => {
        setBusy(true);
        setMessage('');
        try { await fn(); } catch (err) { setMessage(err.message || 'Something went wrong.'); } finally { setBusy(false); }
    };

    const openItem = (n) => act(async () => {
        if (!n.read) {
            await window.api.notifications.markRead([n.id]);
            setItems(list => list.map(x => x.id === n.id ? { ...x, read: true } : x));
            setUnread(u => Math.max(0, u - 1));
        }
        setOpen(false);
        if (n.link && onNavigate) onNavigate(n.link);
    });

    const markAll = () => act(async () => { await window.api.notifications.markAllRead(); await refresh(); });
    const clearAll = () => act(async () => { await window.api.notifications.clear(); await refresh(); });
    const togglePref = (p) => act(async () => {
        await window.api.notifications.setPref(p.id, !p.enabled);
        setPrefs(list => list.map(x => x.id === p.id ? { ...x, enabled: !p.enabled } : x));
    });
    const togglePush = () => act(async () => {
        if (pushState === 'on') await window.PushClient.disable();
        else await window.PushClient.enable();
        setPushState(await window.PushClient.status());
    });

    const pushLabel = {
        on: 'On for this device', off: 'Off', blocked: 'Blocked in browser settings',
        unsupported: 'Not available in this browser', unavailable: 'Not set up on the server'
    }[pushState];
    const pushCanToggle = pushState === 'on' || pushState === 'off';

    return (
        <div className="nb-root" ref={rootRef}>
            <button type="button" className="nb-bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <window.FeatherIcon name="bell" size={20} gap={0} />
                {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>

            {open && (
                <div className="nb-menu" role="dialog" aria-label="Notifications">
                    <div className="nb-head">
                        <strong>Notifications</strong>
                        <div className="nb-head-actions">
                            <button type="button" className="nb-link" onClick={markAll} disabled={busy || unread === 0}>Mark all read</button>
                            <button type="button" className="nb-link" onClick={clearAll} disabled={busy || items.length === 0}>Clear</button>
                        </div>
                    </div>

                    {message && <div className="nb-message" role="alert">{message}</div>}

                    <div className="nb-list">
                        {items.length === 0 && <div className="nb-empty">Nothing yet. Friend requests, study rooms and streaks will show up here.</div>}
                        {items.map(n => (
                            <button type="button" key={n.id} className={`nb-item ${n.read ? '' : 'is-unread'}`} onClick={() => openItem(n)}>
                                <span className="nb-dot" aria-hidden="true" />
                                <span className="nb-text">
                                    <span className="nb-title">{n.title}</span>
                                    {n.body && <span className="nb-body">{n.body}</span>}
                                    <span className="nb-time">{ncAgo(n.createdAt)}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="nb-settings">
                        <div className="nb-setting">
                            <div>
                                <div className="nb-setting-name">Push notifications</div>
                                <div className="nb-setting-sub">{pushLabel}</div>
                            </div>
                            <button type="button" role="switch" aria-checked={pushState === 'on'} aria-label="Push notifications"
                                className={`nb-switch ${pushState === 'on' ? 'is-on' : ''}`} disabled={busy || !pushCanToggle} onClick={togglePush}><span /></button>
                        </div>
                        {prefs.map(p => (
                            <div className="nb-setting" key={p.id}>
                                <div className="nb-setting-name">{p.label}</div>
                                <button type="button" role="switch" aria-checked={p.enabled} aria-label={p.label}
                                    className={`nb-switch ${p.enabled ? 'is-on' : ''}`} disabled={busy} onClick={() => togglePref(p)}><span /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {toast && !open && (
                <button type="button" className="nb-toast" onClick={() => { setToast(null); setOpen(true); }}>
                    <strong>{toast.title}</strong>
                    {toast.body && <span>{toast.body}</span>}
                </button>
            )}
        </div>
    );
};

window.NotificationBell = NotificationBell;
