// Validation: LeaveGuard (src/utils/leaveGuard.js) - leaving the app mid-session
// starts a 30 s return window; not returning collapses the building.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'leaveGuard.js'), 'utf8');

// A fake clock: timers fire only when the test advances time
function makeClock() {
    let t = 0, id = 0;
    const timers = new Map();
    return {
        now: () => t,
        setTimeout: (fn, ms) => { id++; timers.set(id, { fn, at: t + ms }); return id; },
        clearTimeout: (i) => timers.delete(i),
        advance(ms) {
            const end = t + ms;
            for (;;) {
                const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                timers.delete(next[0]); t = next[1].at; next[1].fn();
            }
            t = end;
        }
    };
}

function load() {
    const win = { addEventListener() {}, removeEventListener() {} };
    const ctx = vm.createContext({ window: win, setTimeout, clearTimeout, console });
    vm.runInContext(SRC, ctx);
    return win.LeaveGuard;
}

describe('LeaveGuard state machine', () => {
    let LG, clock, log, guard;
    beforeEach(() => {
        LG = load(); clock = makeClock(); log = [];
        guard = LG.create({
            now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
            onAway: (e) => log.push(['away', e.graceMs]),
            onBack: (e) => log.push(['back', e.awayMs]),
            onExpire: () => log.push(['expire'])
        });
    });

    test('the return window is 30 seconds (as promised in the proposal)', () => {
        assert.equal(LG.GRACE_MS, 30000);
        assert.equal(guard.graceMs, 30000);
    });

    test('does nothing when no session is running', () => {
        assert.equal(guard.leave(), false);
        clock.advance(60000);
        assert.deepEqual(log, []);
    });

    test('leaving then coming back inside 30 s keeps the building', () => {
        guard.setActive(true);
        assert.equal(guard.leave(), true);
        assert.equal(guard.isAway(), true);
        clock.advance(12000);
        assert.equal(guard.back(), true);
        clock.advance(60000);
        assert.deepEqual(log, [['away', 30000], ['back', 12000]]);
        assert.equal(guard.hasExpired(), false);
    });

    test('not coming back within 30 s collapses the building exactly once', () => {
        guard.setActive(true);
        guard.leave();
        clock.advance(29999);
        assert.deepEqual(log, [['away', 30000]], 'still inside the window');
        clock.advance(2);
        assert.deepEqual(log, [['away', 30000], ['expire']]);
        clock.advance(120000);
        assert.equal(log.filter(e => e[0] === 'expire').length, 1);
    });

    test('coming back after the window has closed does not undo the collapse', () => {
        guard.setActive(true);
        guard.leave();
        clock.advance(31000);
        assert.equal(guard.back(), false);
        assert.equal(guard.hasExpired(), true);
        assert.equal(log.filter(e => e[0] === 'back').length, 0);
    });

    test('repeated hidden events (visibility + blur + pagehide) start one countdown', () => {
        guard.setActive(true);
        assert.equal(guard.leave(), true);
        assert.equal(guard.leave(), false);
        assert.equal(guard.leave(), false);
        assert.equal(log.filter(e => e[0] === 'away').length, 1);
    });

    test('a second trip after returning gets a fresh 30 s', () => {
        guard.setActive(true);
        guard.leave(); clock.advance(20000); guard.back();
        guard.leave(); clock.advance(25000);
        assert.equal(log.filter(e => e[0] === 'expire').length, 0);
        clock.advance(6000);
        assert.equal(log.filter(e => e[0] === 'expire').length, 1);
    });

    test('ending the session cancels a running countdown', () => {
        guard.setActive(true);
        guard.leave();
        clock.advance(10000);
        guard.setActive(false);
        clock.advance(60000);
        assert.deepEqual(log, [['away', 30000]]);
    });

    test('suspend() (Study AI file picker) prevents a leave from counting', () => {
        guard.setActive(true);
        const release = guard.suspend();
        assert.equal(guard.leave(), false);
        clock.advance(60000);
        assert.deepEqual(log, []);
        release();
        assert.equal(guard.isSuspended(), false);
        assert.equal(guard.leave(), true, 'detection is back once the picker closes');
    });

    test('a forgotten suspend() cannot switch detection off forever', () => {
        guard.setActive(true);
        guard.suspend();                       // never released
        assert.equal(guard.leave(), false);
        clock.advance(180001);
        assert.equal(guard.isSuspended(), false);
        assert.equal(guard.leave(), true);
    });

    test('release() is safe to call twice', () => {
        guard.setActive(true);
        const a = guard.suspend(), b = guard.suspend();
        a(); a();
        assert.equal(guard.isSuspended(), true, 'the second suspend is still held');
        b();
        assert.equal(guard.isSuspended(), false);
    });
});

describe('LeaveGuard page wiring', () => {
    test('attach() reacts to tab hidden/visible, window blur/focus and pagehide, and detaches cleanly', () => {
        const LG = load();
        const events = {};
        const doc = {
            visibilityState: 'visible', hasFocus: () => false,
            addEventListener: (n, f) => { events['doc:' + n] = f; },
            removeEventListener: (n) => { delete events['doc:' + n]; }
        };
        const win = {
            addEventListener: (n, f) => { events['win:' + n] = f; },
            removeEventListener: (n) => { delete events['win:' + n]; }
        };
        const calls = [];
        const fakeGuard = { leave: () => calls.push('leave'), back: () => calls.push('back') };
        const detach = LG.attach(fakeGuard, doc, win);
        assert.deepEqual(Object.keys(events).sort(), ['doc:visibilitychange', 'win:blur', 'win:focus', 'win:pagehide']);

        doc.visibilityState = 'hidden'; events['doc:visibilitychange']();
        doc.visibilityState = 'visible'; events['doc:visibilitychange']();
        events['win:pagehide']();
        assert.deepEqual(calls, ['leave', 'back', 'leave']);

        detach();
        assert.deepEqual(Object.keys(events), []);
    });
});
