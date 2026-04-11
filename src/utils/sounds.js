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
            // Crash sound (noise burst)
            if (!enabled) return;
            const c = getCtx();
            if (!c) return;

            const bufferSize = c.sampleRate * 0.3;
            const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noise = c.createBufferSource();
            noise.buffer = buffer;
            const gain = c.createGain();
            gain.gain.setValueAtTime(0.25, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.3);
            noise.connect(gain);
            gain.connect(c.destination);
            noise.start();
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
