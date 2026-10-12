// src/utils/sounds.js — BUILDHAUS Sound Effects (Web Audio API)
// Generates all sounds programmatically — no external audio files needed.

const SoundManager = (() => {
    let ctx = null;
    let enabled = true;

    const getCtx = () => {
        if (!ctx) {
            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API not supported');
                return null;
            }
        }
        // Resume if suspended (browsers require user gesture)
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    };

    const playTone = (frequency, duration, type = 'sine', volume = 0.3) => {
        if (!enabled) return;
        const c = getCtx();
        if (!c) return;

        const osc = c.createOscillator();
        const gain = c.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, c.currentTime);
        gain.gain.setValueAtTime(volume, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + duration);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + duration);
    };

    const playNotes = (notes, type = 'sine', volume = 0.25) => {
        if (!enabled) return;
        notes.forEach(([freq, time, dur]) => {
            setTimeout(() => playTone(freq, dur || 0.2, type, volume), time);
        });
    };

    // Browsers only let audio start from a real user gesture (click, key,
    // touchEND — not touchstart). Resume the context on every such gesture so a
    // crash triggered from a touchstart on mobile is still audible.
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const unlock = () => { if (enabled) getCtx(); };
        ['pointerdown', 'keydown', 'touchend'].forEach(ev =>
            window.addEventListener(ev, unlock, { passive: true, capture: true }));
    }

    return {
        // Toggle sound on/off
        toggle() { enabled = !enabled; return enabled; },
        isEnabled() { return enabled; },

        // ── Session Events ────────────────────────────
        sessionStart() {
            // Ascending 3-note chime
            playNotes([
                [523, 0, 0.15],    // C5
                [659, 120, 0.15],  // E5
                [784, 240, 0.3],   // G5
            ], 'sine', 0.3);
        },

        sessionComplete() {
            // Triumphant fanfare
            playNotes([
                [523, 0, 0.15],     // C5
                [659, 100, 0.15],   // E5
                [784, 200, 0.15],   // G5
                [1047, 350, 0.4],   // C6 (high)
            ], 'sine', 0.35);
        },

        sessionFail() {
            // Low descending tones
            playNotes([
                [400, 0, 0.2],
                [300, 150, 0.2],
                [200, 300, 0.4],
            ], 'sawtooth', 0.15);
        },

        // ── Building Events ───────────────────────────
        buildStageUp() {
            // Short upward blip
            playNotes([
                [440, 0, 0.08],   // A4
                [554, 80, 0.12],  // C#5
            ], 'triangle', 0.2);
        },

        buildComplete() {
            // Celebratory arpeggio
            playNotes([
                [523, 0, 0.1],
                [659, 80, 0.1],
                [784, 160, 0.1],
                [1047, 240, 0.1],
                [784, 340, 0.1],
                [1047, 420, 0.3],
            ], 'sine', 0.25);
        },
        
        demolish() {
            // Building collapse: a layered crash that lasts as long as the
            // collapse animation (4 phases fall 0.5 s apart in GameScene).
            //   • heavy impact thump + sharp crack at the start
            //   • a debris hit as each of the next three phases comes down
            //   • a low rumble underneath the whole thing
            // Everything runs through a compressor + master gain so the crash
            // lands at the same perceived loudness as the other game sounds
            // (their peaks are 0.2–0.35) without clipping.
            if (!enabled) return;
            const c = getCtx();
            if (!c) return;

            const now = c.currentTime;
            const TOTAL = 2.2; // seconds

            // Shared output chain
            const master = c.createGain();
            master.gain.setValueAtTime(0.9, now);
            let out = master;
            if (typeof c.createDynamicsCompressor === 'function') {
                const comp = c.createDynamicsCompressor();
                comp.threshold.setValueAtTime(-14, now);
                comp.knee.setValueAtTime(8, now);
                comp.ratio.setValueAtTime(6, now);
                comp.attack.setValueAtTime(0.003, now);
                comp.release.setValueAtTime(0.25, now);
                comp.connect(master);
                out = comp;
            }
            master.connect(c.destination);

            // One noise buffer reused by every noisy layer (integer length!)
            const len = Math.floor(c.sampleRate * TOTAL);
            const buffer = c.createBuffer(1, len, c.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

            const noiseHit = (start, dur, peak, fromHz, toHz) => {
                const src = c.createBufferSource();
                src.buffer = buffer;
                const filter = c.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(fromHz, now + start);
                filter.frequency.exponentialRampToValueAtTime(toHz, now + start + dur);
                const g = c.createGain();
                g.gain.setValueAtTime(0.0001, now + start);
                g.gain.linearRampToValueAtTime(peak, now + start + 0.008);
                g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
                src.connect(filter);
                filter.connect(g);
                g.connect(out);
                src.start(now + start);
                src.stop(now + start + dur);
            };

            const thump = (start, dur, peak, fromHz, toHz) => {
                const osc = c.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(fromHz, now + start);
                osc.frequency.exponentialRampToValueAtTime(toHz, now + start + dur);
                const g = c.createGain();
                g.gain.setValueAtTime(0.0001, now + start);
                g.gain.linearRampToValueAtTime(peak, now + start + 0.01);
                g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
                osc.connect(g);
                g.connect(out);
                osc.start(now + start);
                osc.stop(now + start + dur);
            };

            // Initial collapse
            thump(0, 0.45, 0.7, 130, 38);
            noiseHit(0, 0.35, 0.6, 6000, 900);

            // Each lower phase hitting the ground
            [[0.5, 0.5], [1.0, 0.45], [1.5, 0.4]].forEach(([t, p]) => {
                noiseHit(t, 0.3, p, 3500, 500);
                thump(t, 0.3, p * 0.8, 95, 40);
            });

            // Rumble bed under the whole collapse
            const rumble = c.createBufferSource();
            rumble.buffer = buffer;
            const lp = c.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(380, now);
            const rg = c.createGain();
            rg.gain.setValueAtTime(0.0001, now);
            rg.gain.linearRampToValueAtTime(0.35, now + 0.15);
            rg.gain.setValueAtTime(0.35, now + 1.6);
            rg.gain.exponentialRampToValueAtTime(0.001, now + TOTAL);
            rumble.connect(lp);
            lp.connect(rg);
            rg.connect(out);
            rumble.start(now);
            rumble.stop(now + TOTAL);
        },

        // ── Reward Events ─────────────────────────────
        coinEarned() {
            playNotes([
                [1200, 0, 0.05],
                [1600, 50, 0.08],
            ], 'sine', 0.2);
        },

        achievementUnlocked() {
            // Sparkly ascending melody
            playNotes([
                [784, 0, 0.12],    // G5
                [880, 100, 0.12],  // A5
                [988, 200, 0.12],  // B5
                [1047, 300, 0.12], // C6
                [1319, 450, 0.3],  // E6
            ], 'sine', 0.3);
        },

        streakMilestone() {
            playNotes([
                [523, 0, 0.1],
                [659, 100, 0.1],
                [784, 200, 0.1],
                [1047, 300, 0.2],
                [1319, 450, 0.3],
            ], 'triangle', 0.25);
        },

        // ── UI Events ─────────────────────────────────
        buttonClick() {
            playTone(800, 0.05, 'sine', 0.1);
        },

        tabSwitch() {
            playTone(600, 0.04, 'triangle', 0.08);
        },

        tick() {
            // Subtle tick for last 10 seconds
            playTone(1000, 0.02, 'sine', 0.08);
        },
    };
})();

window.SoundManager = SoundManager;
