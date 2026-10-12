// Validation: SoundManager (src/utils/sounds.js) with a recording fake of the
// Web Audio API, plus a check that a building collapse actually triggers the
// demolish sound.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..', '..');
const SOUNDS_SRC = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'sounds.js'), 'utf8');

// ── Fake Web Audio graph that records everything ─────────────────────────────
function makeFakeAudio() {
    const log = { nodes: [], started: [], ctxCount: 0, resumed: 0 };
    class Param {
        constructor(v = 0) { this.value = v; this.events = []; }
        setValueAtTime(v, t) { this.events.push(['set', v, t]); return this; }
        linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); return this; }
        exponentialRampToValueAtTime(v, t) {
            if (v <= 0) throw new RangeError('exponentialRamp target must be > 0');
            this.events.push(['exp', v, t]); return this;
        }
        setTargetAtTime(v, t) { this.events.push(['target', v, t]); return this; }
        get peak() { return Math.max(this.value, ...this.events.map(e => e[1])); }
        get end() { return Math.max(0, ...this.events.map(e => e[2])); }
    }
    class Node {
        constructor(kind, ctx) { this.kind = kind; this.ctx = ctx; this.outs = []; log.nodes.push(this); }
        connect(n) { this.outs.push(n); return n; }
        disconnect() { this.outs = []; }
    }
    class AudioContext {
        constructor() { log.ctxCount++; this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = new Node('destination', this); }
        resume() { log.resumed++; this.state = 'running'; return Promise.resolve(); }
        createOscillator() {
            const n = new Node('osc', this); n.type = 'sine'; n.frequency = new Param(440);
            n.start = (t = 0) => { n.startAt = t; log.started.push(n); };
            n.stop = (t) => { n.stopAt = t; };
            return n;
        }
        createGain() { const n = new Node('gain', this); n.gain = new Param(1); return n; }
        createBiquadFilter() { const n = new Node('filter', this); n.type = 'lowpass'; n.frequency = new Param(350); n.Q = new Param(1); return n; }
        createDynamicsCompressor() {
            const n = new Node('compressor', this);
            for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0);
            return n;
        }
        createBuffer(ch, length, rate) {
            if (!Number.isInteger(length)) throw new TypeError(`buffer length must be an integer, got ${length}`);
            const data = Array.from({ length: ch }, () => new Float32Array(length));
            return { numberOfChannels: ch, length, sampleRate: rate, duration: length / rate, getChannelData: i => data[i] };
        }
        createBufferSource() {
            const n = new Node('noise', this); n.buffer = null; n.playbackRate = new Param(1);
            n.start = (t = 0) => { n.startAt = t; log.started.push(n); };
            n.stop = (t) => { n.stopAt = t; };
            return n;
        }
    }
    return { AudioContext, log };
}

function loadSoundManager() {
    const { AudioContext, log } = makeFakeAudio();
    const timers = [];
    const window = { AudioContext };
    const sandbox = {
        window, console,
        setTimeout: (fn, ms) => { timers.push([fn, ms]); return timers.length; },
        Math, Float32Array
    };
    vm.runInNewContext(SOUNDS_SRC, sandbox, { filename: 'sounds.js' });
    const flush = () => { while (timers.length) timers.shift()[0](); };
    return { SM: window.SoundManager, log, flush };
}

// Does `node` eventually reach the destination? Returns the gains along the path.
function pathToDestination(node, seen = new Set()) {
    if (node.kind === 'destination') return [];
    if (seen.has(node)) return null;
    seen.add(node);
    for (const out of node.outs) {
        const rest = pathToDestination(out, seen);
        if (rest) return node.kind === 'gain' ? [node, ...rest] : rest;
    }
    return null;
}

// Loudest scheduled level of any source that reaches the speakers
function peakLevel(log) {
    let peak = 0;
    for (const src of log.started) {
        const gains = pathToDestination(src);
        if (!gains) continue;
        peak = Math.max(peak, gains.reduce((acc, g) => acc * g.gain.peak, 1));
    }
    return peak;
}
const lastSound = (log) => Math.max(0, ...log.started.map(n => n.stopAt || 0));

describe('SoundManager.demolish()', () => {
    let SM, log, flush;
    beforeEach(() => ({ SM, log, flush } = loadSoundManager()));

    test('produces audible sources that are wired all the way to the speakers', () => {
        SM.demolish(); flush();
        assert.ok(log.started.length >= 2, 'expected a layered crash (impact + debris)');
        const connected = log.started.filter(n => pathToDestination(n));
        assert.equal(connected.length, log.started.length, 'some sources are never connected to the destination');
    });

    test('is at least as prominent as the loudest other game sound, without clipping', () => {
        const others = ['sessionStart', 'sessionComplete', 'sessionFail', 'buildStageUp', 'buildComplete', 'achievementUnlocked', 'streakMilestone', 'coinEarned'];
        let loudestOther = 0;
        for (const name of others) {
            const s = loadSoundManager();
            s.SM[name](); s.flush();
            loudestOther = Math.max(loudestOther, peakLevel(s.log));
        }
        SM.demolish(); flush();
        const demolishPeak = peakLevel(log);
        assert.ok(demolishPeak >= loudestOther, `demolish peak ${demolishPeak.toFixed(2)} < loudest other ${loudestOther.toFixed(2)}`);
        assert.ok(demolishPeak <= 1.0, `demolish peak ${demolishPeak.toFixed(2)} would clip`);
    });

    test('lasts long enough to cover the collapse animation (≥ 1.5 s), not a 0.2 s blip', () => {
        SM.demolish(); flush();
        assert.ok(lastSound(log) >= 1.5, `demolish ends after ${lastSound(log)} s`);
    });

    test('uses integer buffer lengths (non-integer lengths throw on some browsers)', () => {
        assert.doesNotThrow(() => { SM.demolish(); flush(); });
    });

    test('is silent when sound is toggled off', () => {
        SM.toggle();
        SM.demolish(); flush();
        assert.equal(log.started.length, 0);
    });
});

describe('SoundManager — general robustness', () => {
    test('every public sound is callable and never throws', () => {
        const { SM, flush } = loadSoundManager();
        for (const [name, fn] of Object.entries(SM)) {
            if (typeof fn === 'function' && !['toggle', 'isEnabled', 'setEnabled', 'unlock'].includes(name)) {
                assert.doesNotThrow(() => { fn(); flush(); }, name);
            }
        }
    });

    test('degrades silently when the browser has no Web Audio API', () => {
        const sandbox = { window: {}, console: { warn() {} , log() {} }, setTimeout: (f) => f(), Math, Float32Array };
        vm.runInNewContext(SOUNDS_SRC, sandbox);
        assert.doesNotThrow(() => { sandbox.window.SoundManager.demolish(); sandbox.window.SoundManager.sessionStart(); });
    });
});

describe('Building collapse → demolish sound wiring', () => {
    const game = fs.readFileSync(path.join(ROOT, 'src', 'components', 'GameScene.jsx'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf8');

    test('destroyHouse() notifies the app (so the sound plays) when a building collapses', () => {
        const start = game.indexOf('const destroyHouse');
        assert.ok(start > -1, 'destroyHouse not found');
        const body = game.slice(start, game.indexOf('\n    };', start));
        assert.match(body, /onDemolish|SoundManager\.demolish/, 'destroyHouse never triggers the demolish sound');
    });

    test('App reacts to the collapse: plays demolish exactly once and records the interrupted session', () => {
        assert.match(app, /onDemolish=\{/, 'GameScene is not given an onDemolish handler');
        const plays = (app.match(/SoundManager\.demolish\(\)/g) || []).length;
        assert.equal(plays, 1, `demolish() is referenced ${plays} times in App.jsx`);
        assert.match(app, /setInterruptionDetected\(true\)/, 'nothing ever sets interruptionDetected — interrupted sessions are never synced');
    });
});
