// src/utils/leaveGuard.js - detects the student leaving the app during a focus session.
//
// Leaving means: switching tab, minimising, locking the screen, taking a call or
// switching to another app/window. The session pauses at once (no progress is
// earned while away) and a return window starts. Back within the window: the
// session carries on. Not back in time: the building collapses.
//
// The detector is a plain state machine with injected timers so it can be
// tested without a browser; `attach()` wires it to the real page events.
(function () {
    const GRACE_MS = 30000;          // return window, per the project proposal
    const BLUR_DEBOUNCE_MS = 2000;   // a window that merely lost focus must stay unfocused this long
    const MAX_SUSPEND_MS = 180000;   // a forgotten suspend can never disable detection for longer

    function create(opts) {
        opts = opts || {};
        const graceMs = opts.graceMs || GRACE_MS;
        const now = opts.now || (() => Date.now());
        const setT = opts.setTimeout || ((f, ms) => setTimeout(f, ms));
        const clearT = opts.clearTimeout || ((id) => clearTimeout(id));
        const cb = {
            onAway: opts.onAway || (() => {}),      // left; { graceMs, deadline }
            onBack: opts.onBack || (() => {}),      // returned in time; { awayMs }
            onExpire: opts.onExpire || (() => {})   // not back in time
        };

        let active = false, awayAt = null, timerId = null, expired = false, suspended = 0;

        const clearTimer = () => { if (timerId !== null) { clearT(timerId); timerId = null; } };

        function expire() {
            timerId = null;
            if (awayAt === null) return;
            expired = true;
            cb.onExpire({ awayMs: now() - awayAt });
        }

        return {
            // A session started or ended
            setActive(on) {
                active = !!on;
                if (!active) { clearTimer(); awayAt = null; }
                expired = false;
            },
            // The page was hidden / lost focus
            leave() {
                if (!active || suspended > 0 || awayAt !== null || expired) return false;
                awayAt = now();
                timerId = setT(expire, graceMs);
                cb.onAway({ graceMs, deadline: awayAt + graceMs });
                return true;
            },
            // The page is visible / focused again
            back() {
                if (awayAt === null || expired) return false;
                clearTimer();
                const awayMs = now() - awayAt;
                awayAt = null;
                cb.onBack({ awayMs });
                return true;
            },
            // Pause detection while the student does something inside the app that
            // legitimately hands focus away (e.g. the file picker in Study AI)
            suspend() {
                suspended++;
                let released = false;
                const release = () => { if (!released) { released = true; suspended = Math.max(0, suspended - 1); } };
                setT(release, MAX_SUSPEND_MS);
                return release;
            },
            isAway: () => awayAt !== null && !expired,
            hasExpired: () => expired,
            isSuspended: () => suspended > 0,
            graceMs
        };
    }

    // Wire a guard to the real page: tab switch, minimise, screen lock, app switch,
    // and a window that stays unfocused (another window in front).
    function attach(guard, doc, win) {
        doc = doc || document; win = win || window;
        let blurTimer = null;
        const onVisibility = () => { doc.visibilityState === 'hidden' ? guard.leave() : guard.back(); };
        const onBlur = () => {
            clearTimeout(blurTimer);
            blurTimer = setTimeout(() => { if (!doc.hasFocus()) guard.leave(); }, BLUR_DEBOUNCE_MS);
        };
        const onFocus = () => { clearTimeout(blurTimer); if (doc.visibilityState !== 'hidden') guard.back(); };
        const onPageHide = () => guard.leave();
        doc.addEventListener('visibilitychange', onVisibility);
        win.addEventListener('blur', onBlur);
        win.addEventListener('focus', onFocus);
        win.addEventListener('pagehide', onPageHide);
        return () => {
            clearTimeout(blurTimer);
            doc.removeEventListener('visibilitychange', onVisibility);
            win.removeEventListener('blur', onBlur);
            win.removeEventListener('focus', onFocus);
            win.removeEventListener('pagehide', onPageHide);
        };
    }

    // The app registers its guard here so other components (Study AI) can pause it
    let shared = null;
    window.LeaveGuard = {
        create, attach, GRACE_MS,
        register(g) { shared = g; },
        suspend() { return shared ? shared.suspend() : () => {}; }
    };
})();
