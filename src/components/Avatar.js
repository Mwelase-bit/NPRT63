// Avatar.js - the student's builder as a proper 3D game character.
//
// createAvatar(look) returns a THREE.Group, feet at y = 0 and facing +Z, with a real face
// (eyes with iris and highlights, brows, nose, mouth, ears, cheeks), hair styles, facial hair,
// glasses, outfits, hats and a tool. It is used twice: as the live preview on the Profile
// screen, and as the builder who hammers on the construction site.
//
// group.userData.parts holds the pivots the scene animates: lLeg, rLeg, lArm, rArm, head.
// group.userData.animateIdle(t) gives breathing, blinking and a gentle head sway.
//
// Everything is validated: unknown or missing values fall back to defaults, so a damaged
// saved look can never break the scene. Exposes window.AvatarFactory.
(function () {
    const T = window.THREE;

    // ── Options the Profile screen offers (and the server accepts) ─────────────────
    const OPTIONS = {
        hairStyles: ['short', 'spiky', 'long', 'ponytail', 'bun', 'afro', 'curly', 'buzz', 'bald'],
        mouths: ['smile', 'grin', 'neutral', 'smirk'],
        facialHair: ['none', 'stubble', 'moustache', 'beard'],
        glasses: ['none', 'round', 'square'],
        skinColors: ['#FDE0D0', '#FDBCB4', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#5C3A21'],
        hairColors: ['#1b1b1b', '#4a2f1b', '#8B4513', '#B5651D', '#E6BE8A', '#FFD700', '#A52A2A', '#C0C0C0', '#6A5ACD'],
        eyeColors: ['#4b2e1b', '#2f6fbf', '#3f8f4f', '#7a7a7a', '#8a5a2b', '#5b3a8f'],
        outfitColors: ['#4169E1', '#FF8C00', '#32CD32', '#FF69B4', '#9370DB', '#DC143C', '#20B2AA', '#2F4F4F'],
        hatColors: ['#FFD700', '#FF4500', '#00CED1', '#FF1493', '#7FFF00', '#FFFFFF', '#222222']
    };

    const DEFAULT_LOOK = {
        gender: 'male', skinColor: '#F1C27D', hairColor: '#4a2f1b', eyeColor: '#4b2e1b',
        overallColor: '#4169E1', hatColor: '#FFD700', hairStyle: 'short', mouth: 'smile',
        facialHair: 'none', glasses: 'none', outfit: 'default', hat: 'hardhat', tool: 'hammer'
    };

    const HEX = /^#[0-9a-fA-F]{6}$/;
    const ENUMS = {
        gender: ['male', 'female', 'other'], hairStyle: OPTIONS.hairStyles, mouth: OPTIONS.mouths,
        facialHair: OPTIONS.facialHair, glasses: OPTIONS.glasses,
        outfit: ['default', 'outfit_architect', 'outfit_wizard', 'outfit_ninja', 'outfit_knight', 'outfit_astronaut'],
        hat: ['hardhat', 'cap', 'none', 'hat_tophat', 'hat_crown', 'hat_beret', 'hat_beanie', 'hat_helmet'],
        tool: ['hammer', 'none', 'tool_wrench', 'tool_paintbrush', 'tool_drill', 'tool_wand']
    };

    // Fill gaps and drop anything invalid so rendering never throws on bad data
    function normalize(look) {
        const out = { ...DEFAULT_LOOK };
        if (!look || typeof look !== 'object') return out;
        for (const key of Object.keys(DEFAULT_LOOK)) {
            const v = look[key];
            if (ENUMS[key]) { if (ENUMS[key].includes(v)) out[key] = v; }
            else if (typeof v === 'string' && HEX.test(v)) out[key] = v;
        }
        return out;
    }

    const shade = (hex, f) => '#' + new T.Color(hex).multiplyScalar(f).getHexString();
    const std = (color, rough, metal, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough === undefined ? 0.7 : rough, metalness: metal === undefined ? 0.02 : metal }, extra || {}));

    function mk(parent, geo, mat, x, y, z) {
        const m = new T.Mesh(geo, mat);
        m.position.set(x || 0, y || 0, z || 0);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    }

    // ── Outfits: colours for each part, plus a function that adds the extras ───────
    function outfitSpec(look) {
        const c = look.overallColor;
        switch (look.outfit) {
            case 'outfit_architect': return { kind: 'suit', top: '#2b3445', sleeve: '#2b3445', leg: '#2b3445', boot: '#1b1b1f', hand: look.skinColor };
            case 'outfit_wizard': return { kind: 'robe', top: '#4b2e83', sleeve: '#4b2e83', leg: '#3a2368', boot: '#2a1a4a', hand: look.skinColor };
            case 'outfit_ninja': return { kind: 'ninja', top: '#1d2026', sleeve: '#1d2026', leg: '#1d2026', boot: '#111317', hand: '#1d2026' };
            case 'outfit_knight': return { kind: 'knight', top: '#aab3c0', sleeve: '#aab3c0', leg: '#8f98a6', boot: '#6f7886', hand: '#8f98a6' };
            case 'outfit_astronaut': return { kind: 'astro', top: '#f2f4f8', sleeve: '#f2f4f8', leg: '#e6e9ef', boot: '#c9ced8', hand: '#e6e9ef' };
            default: return { kind: 'overalls', top: '#e9eef5', sleeve: '#e9eef5', leg: c, boot: '#5b3a24', hand: look.skinColor, bib: c };
        }
    }

    // ── Hair ──────────────────────────────────────────────────────────────────────
    function addHair(head, look, hairMat) {
        const s = look.hairStyle;
        if (s === 'bald') return;
        // The cap is tilted back so its front edge sits high on the forehead (clear of the eyes)
        const cap = (r, theta, y, z) => {
            const m = mk(head, new T.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, theta), hairMat, 0, y, z);
            m.scale.set(1, 1.04, 1.02);
            m.rotation.x = -0.32;
            return m;
        };
        if (s === 'buzz') { cap(0.288, Math.PI * 0.44, 0.02, -0.005); return; }
        cap(0.3, Math.PI * 0.5, 0.045, -0.03);                                    // base cap for every other style
        // Fringe across the forehead, only when no hat sits on top (a hat would hide it, and its corners poke through)
        if (['none', 'hat_crown', 'hat_helmet', 'hat_tophat', 'hat_beret'].includes(look.hat)) {
            const fringe = mk(head, new T.SphereGeometry(0.15, 14, 10), hairMat, 0, 0.2, 0.175);
            fringe.scale.set(s === 'spiky' ? 1.3 : 1.6, 0.5, 0.85);
            fringe.rotation.x = -0.45;
        }
        if (s === 'spiky') {
            for (let i = 0; i < 9; i++) {
                const a = (i / 9) * Math.PI * 2;
                const spike = mk(head, new T.ConeGeometry(0.07, 0.24, 6), hairMat, Math.cos(a) * 0.17, 0.33, Math.sin(a) * 0.17 - 0.02);
                spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
            }
        } else if (s === 'long') {
            const back = mk(head, new T.CapsuleGeometry(0.2, 0.55, 6, 12), hairMat, 0, -0.28, -0.14);
            back.scale.set(1.05, 1, 0.7);
            [-1, 1].forEach(sd => mk(head, new T.CapsuleGeometry(0.06, 0.34, 4, 8), hairMat, sd * 0.25, -0.13, 0.06));
        } else if (s === 'ponytail') {
            const tail = mk(head, new T.CapsuleGeometry(0.075, 0.42, 6, 10), hairMat, 0, -0.18, -0.34);
            tail.rotation.x = 0.5;
            const tie = mk(head, new T.TorusGeometry(0.07, 0.016, 6, 14), std('#ff5a7a', 0.5), 0, 0.02, -0.3);
            tie.rotation.x = Math.PI / 2 - 0.4;
        } else if (s === 'bun') {
            mk(head, new T.SphereGeometry(0.13, 14, 12), hairMat, 0, 0.3, -0.16);
            const tie = mk(head, new T.TorusGeometry(0.1, 0.015, 6, 14), std('#ff5a7a', 0.5), 0, 0.23, -0.16);
            tie.rotation.x = Math.PI / 2;
        } else if (s === 'afro') {
            const big = mk(head, new T.SphereGeometry(0.4, 22, 18), hairMat, 0, 0.1, -0.15);
            big.scale.set(1.02, 0.95, 0.98);
        } else if (s === 'curly') {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2, r = 0.2 + (i % 2) * 0.05, h = 0.2 + (i % 3) * 0.07;
                mk(head, new T.SphereGeometry(0.085, 10, 8), hairMat, Math.cos(a) * r, h, Math.sin(a) * r - 0.04);
            }
            mk(head, new T.SphereGeometry(0.16, 12, 10), hairMat, 0, 0.3, -0.02);
        }
    }

    // ── Facial hair, mouth, glasses ───────────────────────────────────────────────
    function addFace(head, look, hairMat, skinMat, opts) {
        const dark = std('#1a1a1a', 0.25);
        const skinShade = std(shade(look.skinColor, 0.9), 0.6);
        // ears
        [-1, 1].forEach(s => { const e = mk(head, new T.SphereGeometry(0.052, 12, 10), skinMat, s * 0.275, 0, 0); e.scale.set(0.6, 1, 0.9); });
        // eyes: white, iris, pupil, a tiny highlight so they look alive
        const irisMat = std(look.eyeColor, 0.3);
        const eyes = [];
        [-1, 1].forEach(s => {
            const eye = new T.Group();
            eye.position.set(s * 0.1, 0.035, 0.245);
            head.add(eye);
            const white = mk(eye, new T.SphereGeometry(0.058, 16, 12), std('#ffffff', 0.25), 0, 0, 0);
            white.scale.set(1, 1.1, 0.55);
            mk(eye, new T.SphereGeometry(0.036, 14, 12), irisMat, 0, 0, 0.02).scale.set(1, 1.1, 0.5);
            mk(eye, new T.SphereGeometry(0.019, 10, 8), dark, 0, 0, 0.034).scale.set(1, 1.1, 0.4);
            mk(eye, new T.SphereGeometry(0.009, 8, 6), std('#ffffff', 0.1, 0, { emissive: '#ffffff', emissiveIntensity: 0.6 }), 0.012, 0.016, 0.042);
            // eyelid used for blinking: a skin-coloured half disc that scales open/closed
            const lid = mk(eye, new T.SphereGeometry(0.062, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), skinMat, 0, 0.002, 0.004);
            lid.scale.set(1, 0.001, 0.62);
            lid.userData.open = 0.001;
            eyes.push(lid);
            if (look.gender === 'female') {          // lashes
                const lash = mk(eye, new T.BoxGeometry(0.1, 0.012, 0.02), dark, 0, 0.065, 0.03);
                lash.rotation.z = s * -0.18;
            }
        });
        opts.eyelids = eyes;
        // brows (one lifts for a smirk)
        [-1, 1].forEach(s => {
            const brow = mk(head, new T.BoxGeometry(0.1, 0.02, 0.025), std(shade(look.hairColor, look.hairStyle === 'bald' ? 0.9 : 0.85), 0.8), s * 0.1, 0.115 + (look.mouth === 'smirk' && s > 0 ? 0.014 : 0), 0.262);
            brow.rotation.z = s * -0.12 + (look.mouth === 'smirk' && s > 0 ? -0.1 : 0);
        });
        // nose and cheeks
        mk(head, new T.SphereGeometry(0.036, 10, 8), skinShade, 0, -0.03, 0.272).scale.set(1, 1.1, 0.9);
        [-1, 1].forEach(s => {
            const blush = mk(head, new T.CircleGeometry(0.05, 14), new T.MeshBasicMaterial({ color: '#ff7a8a', transparent: true, opacity: 0.22, depthWrite: false }), s * 0.15, -0.065, 0.236);
            blush.rotation.y = s * 0.45;
            blush.castShadow = false;
        });
        // mouth
        const lip = std('#b0454a', 0.45);
        const mouthY = -0.115;
        if (look.mouth === 'grin') {
            mk(head, new T.BoxGeometry(0.115, 0.04, 0.02), std('#fdfdfd', 0.3), 0, mouthY, 0.25);
            const arc = mk(head, new T.TorusGeometry(0.068, 0.011, 6, 16, Math.PI), lip, 0, mouthY + 0.02, 0.246);
            arc.rotation.z = Math.PI;
        } else if (look.mouth === 'neutral') {
            mk(head, new T.BoxGeometry(0.08, 0.014, 0.014), lip, 0, mouthY, 0.256);
        } else if (look.mouth === 'smirk') {
            const arc = mk(head, new T.TorusGeometry(0.05, 0.011, 6, 12, Math.PI * 0.8), lip, 0.025, mouthY + 0.014, 0.252);
            arc.rotation.z = Math.PI + 0.25;
        } else {
            const arc = mk(head, new T.TorusGeometry(0.058, 0.011, 6, 14, Math.PI), lip, 0, mouthY + 0.018, 0.25);
            arc.rotation.z = Math.PI;
        }
        // facial hair
        if (look.facialHair === 'stubble') {
            const st = mk(head, new T.SphereGeometry(0.2885, 22, 14, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.4), std(shade(look.hairColor, 0.8), 1, 0, { transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0, 0, 0);
            st.scale.set(1, 1.08, 0.99);
            st.castShadow = false;
        } else if (look.facialHair === 'moustache') {
            [-1, 1].forEach(s => { const m = mk(head, new T.CapsuleGeometry(0.02, 0.07, 4, 8), hairMat, s * 0.04, -0.075, 0.268); m.rotation.z = Math.PI / 2 - s * 0.25; });
        } else if (look.facialHair === 'beard') {
            const bd = mk(head, new T.SphereGeometry(0.288, 22, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.42), hairMat, 0, -0.005, 0.005);
            bd.scale.set(1, 1.1, 1.0);
            [-1, 1].forEach(s => { const m = mk(head, new T.CapsuleGeometry(0.02, 0.07, 4, 8), hairMat, s * 0.04, -0.072, 0.272); m.rotation.z = Math.PI / 2 - s * 0.25; });
            mk(head, new T.SphereGeometry(0.1, 12, 10), hairMat, 0, -0.2, 0.17).scale.set(1.1, 0.8, 0.9);
        }
        // glasses
        if (look.glasses !== 'none') {
            const frame = std('#22262c', 0.35, 0.5);
            [-1, 1].forEach(s => {
                if (look.glasses === 'round') {
                    mk(head, new T.TorusGeometry(0.082, 0.011, 8, 22), frame, s * 0.1, 0.035, 0.282);
                } else {
                    const x = s * 0.1, y = 0.035, z = 0.284, w = 0.16, h = 0.115, t = 0.012;
                    mk(head, new T.BoxGeometry(w, t, t), frame, x, y + h / 2, z); mk(head, new T.BoxGeometry(w, t, t), frame, x, y - h / 2, z);
                    mk(head, new T.BoxGeometry(t, h, t), frame, x - w / 2, y, z); mk(head, new T.BoxGeometry(t, h, t), frame, x + w / 2, y, z);
                }
                mk(head, new T.BoxGeometry(0.012, 0.012, 0.2), frame, s * 0.18, 0.04, 0.19);        // temple arms
            });
            mk(head, new T.BoxGeometry(0.05, 0.012, 0.012), frame, 0, 0.045, 0.285);               // bridge
        }
    }

    // ── Hats ──────────────────────────────────────────────────────────────────────
    function addHat(head, look) {
        const c = look.hatColor;
        const hatMat = std(c, 0.4);
        switch (look.hat) {
            case 'hardhat':
                mk(head, new T.SphereGeometry(0.31, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, 0, 0.1, 0);
                mk(head, new T.CylinderGeometry(0.37, 0.37, 0.035, 24), hatMat, 0, 0.115, 0.04);
                mk(head, new T.BoxGeometry(0.07, 0.05, 0.52), std(shade(c, 0.85), 0.4), 0, 0.4, 0);
                break;
            case 'cap': {
                mk(head, new T.SphereGeometry(0.3, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, 0, 0.1, 0);
                const visor = mk(head, new T.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), hatMat, 0, 0.115, 0.27);
                visor.scale.set(1, 1, 0.8);
                mk(head, new T.SphereGeometry(0.025, 8, 6), std(shade(c, 0.8), 0.4), 0, 0.4, 0);
                break;
            }
            case 'hat_beanie': {
                mk(head, new T.SphereGeometry(0.31, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), std('#d9344e', 0.9), 0, 0.07, 0);
                mk(head, new T.TorusGeometry(0.295, 0.04, 8, 28), std('#b72a40', 0.9), 0, 0.12, 0).rotation.x = Math.PI / 2;
                mk(head, new T.SphereGeometry(0.06, 12, 10), std('#ffffff', 0.9), 0, 0.4, 0);
                break;
            }
            case 'hat_tophat':
                mk(head, new T.CylinderGeometry(0.4, 0.4, 0.03, 26), std('#17181c', 0.35), 0, 0.2, 0);
                mk(head, new T.CylinderGeometry(0.22, 0.24, 0.42, 22), std('#17181c', 0.35), 0, 0.42, 0);
                mk(head, new T.CylinderGeometry(0.245, 0.245, 0.07, 22), std('#b8323a', 0.5), 0, 0.28, 0);
                break;
            case 'hat_crown': {
                const gold = std('#e6b422', 0.25, 0.85);
                mk(head, new T.CylinderGeometry(0.27, 0.25, 0.1, 22, 1, true), gold, 0, 0.28, 0).material.side = T.DoubleSide;
                for (let i = 0; i < 7; i++) {
                    const a = (i / 7) * Math.PI * 2;
                    mk(head, new T.ConeGeometry(0.05, 0.15, 5), gold, Math.cos(a) * 0.26, 0.38, Math.sin(a) * 0.26);
                    mk(head, new T.SphereGeometry(0.022, 8, 6), std(['#d4202c', '#2255d4', '#1fa84a'][i % 3], 0.15, 0.3, { emissive: ['#d4202c', '#2255d4', '#1fa84a'][i % 3], emissiveIntensity: 0.4 }), Math.cos(a) * 0.26, 0.46, Math.sin(a) * 0.26);
                }
                break;
            }
            case 'hat_beret': {
                const b = mk(head, new T.SphereGeometry(0.3, 20, 12), std('#8e2d4a', 0.9), 0.04, 0.2, 0.02);
                b.scale.set(1.1, 0.4, 1.05);
                b.rotation.z = -0.15;
                mk(head, new T.CylinderGeometry(0.012, 0.012, 0.05, 6), std('#5a1a2e', 0.9), 0.04, 0.3, 0.02);
                break;
            }
            case 'hat_helmet': {
                const glass = std('#9fd3ff', 0.05, 0.1, { transparent: true, opacity: 0.28, depthWrite: false });
                mk(head, new T.SphereGeometry(0.4, 26, 20), glass, 0, 0.0, 0).castShadow = false;
                mk(head, new T.TorusGeometry(0.34, 0.04, 10, 30), std('#e6e9ef', 0.4, 0.3), 0, -0.26, 0).rotation.x = Math.PI / 2;
                break;
            }
            default: break;      // 'none'
        }
    }

    // ── Tools held in the right hand (the hand sits at the arm group's y = -0.72) ──
    function addTool(arm, look) {
        const g = new T.Group();
        g.position.set(0, -0.72, 0.05);
        arm.add(g);
        const wood = std('#6b4a2a', 0.8), steel = std('#8a9099', 0.35, 0.8);
        switch (look.tool) {
            case 'hammer':
                mk(g, new T.CylinderGeometry(0.025, 0.025, 0.46, 8), wood, 0, 0, 0.1).rotation.x = Math.PI / 2;
                mk(g, new T.BoxGeometry(0.12, 0.12, 0.2), std('#666a70', 0.4, 0.5), 0, 0, 0.34);
                break;
            case 'tool_wrench': {
                mk(g, new T.CylinderGeometry(0.03, 0.03, 0.5, 8), std('#e6b422', 0.3, 0.85), 0, 0, 0.12).rotation.x = Math.PI / 2;
                const head = mk(g, new T.TorusGeometry(0.07, 0.03, 8, 16, Math.PI * 1.6), std('#e6b422', 0.3, 0.85), 0, 0, 0.4);
                head.rotation.y = Math.PI / 2;
                break;
            }
            case 'tool_paintbrush':
                mk(g, new T.CylinderGeometry(0.02, 0.025, 0.4, 8), wood, 0, 0, 0.1).rotation.x = Math.PI / 2;
                mk(g, new T.CylinderGeometry(0.04, 0.035, 0.1, 8), steel, 0, 0, 0.32).rotation.x = Math.PI / 2;
                mk(g, new T.BoxGeometry(0.08, 0.03, 0.14), std('#e4415a', 0.9), 0, 0, 0.42);
                break;
            case 'tool_drill':
                mk(g, new T.BoxGeometry(0.1, 0.12, 0.3), std('#e8590c', 0.45, 0.3), 0, 0.02, 0.18);
                mk(g, new T.BoxGeometry(0.08, 0.2, 0.08), std('#22262c', 0.6), 0, -0.1, 0.12);
                mk(g, new T.CylinderGeometry(0.014, 0.014, 0.2, 8), steel, 0, 0.02, 0.43).rotation.x = Math.PI / 2;
                break;
            case 'tool_wand': {
                mk(g, new T.CylinderGeometry(0.014, 0.02, 0.5, 8), std('#3a2a1a', 0.7), 0, 0, 0.15).rotation.x = Math.PI / 2;
                mk(g, new T.OctahedronGeometry(0.05), std('#ffe066', 0.2, 0.2, { emissive: '#ffcc33', emissiveIntensity: 0.9 }), 0, 0, 0.44);
                break;
            }
            default: break;      // 'none'
        }
    }

    // ── The whole character ───────────────────────────────────────────────────────
    function createAvatar(rawLook, options) {
        const look = normalize(rawLook);
        const opts = options || {};
        const female = look.gender === 'female';
        const spec = outfitSpec(look);
        const grp = new T.Group();
        const parts = {};

        const skinMat = std(look.skinColor, 0.55);
        const hairMat = std(look.hairColor, 0.55);
        const topMat = std(spec.top, spec.kind === 'knight' ? 0.3 : 0.75, spec.kind === 'knight' ? 0.8 : 0.02);
        const legMat = std(spec.leg, spec.kind === 'knight' ? 0.35 : 0.8, spec.kind === 'knight' ? 0.75 : 0.02);

        // legs, pivoting at the hip
        [-1, 1].forEach(s => {
            const hip = new T.Group();
            hip.position.set(s * 0.16, 0.95, 0);
            grp.add(hip);
            mk(hip, new T.CapsuleGeometry(0.115, 0.55, 5, 12), legMat, 0, -0.42, 0);
            mk(hip, new T.BoxGeometry(0.22, 0.15, 0.37), std(spec.boot, 0.55, spec.kind === 'knight' ? 0.7 : 0.02), 0, -0.86, 0.06);
            parts[s < 0 ? 'lLeg' : 'rLeg'] = hip;
        });

        // torso
        const torso = mk(grp, new T.CapsuleGeometry(0.3, 0.45, 6, 14), topMat, 0, 1.35, 0);
        torso.scale.set(female ? 0.95 : 1.06, 1, 0.74);
        parts.torso = torso;

        // outfit extras
        if (spec.kind === 'overalls') {
            const denim = std(spec.bib, 0.8);
            mk(grp, new T.BoxGeometry(0.5, 0.5, 0.07), denim, 0, 1.3, 0.2).castShadow = true;                 // bib
            [-1, 1].forEach(s => {
                const strap = mk(grp, new T.BoxGeometry(0.07, 0.6, 0.05), denim, s * 0.19, 1.58, 0.17);
                strap.rotation.z = s * -0.08;
                mk(grp, new T.SphereGeometry(0.03, 8, 6), std('#d4af37', 0.3, 0.8), s * 0.17, 1.42, 0.24);       // buttons
            });
            mk(grp, new T.BoxGeometry(0.2, 0.14, 0.05), std(shade(spec.bib, 0.85), 0.8), 0, 1.3, 0.245);       // chest pocket
            mk(grp, new T.BoxGeometry(0.66, 0.1, 0.42), std('#5b3a24', 0.7), 0, 1.0, 0);                       // tool belt
            mk(grp, new T.BoxGeometry(0.12, 0.12, 0.08), std('#d4af37', 0.3, 0.8), 0, 1.0, 0.22);
            [-0.22, 0.22].forEach(x => mk(grp, new T.BoxGeometry(0.12, 0.16, 0.08), std('#7a5230', 0.8), x, 0.93, 0.22));
        } else if (spec.kind === 'suit') {
            mk(grp, new T.BoxGeometry(0.2, 0.55, 0.05), std('#f5f6f8', 0.6), 0, 1.38, 0.235);                  // shirt front
            const tie = mk(grp, new T.ConeGeometry(0.05, 0.4, 4), std('#c0303a', 0.5), 0, 1.35, 0.265);
            tie.rotation.x = Math.PI;
            mk(grp, new T.BoxGeometry(0.1, 0.07, 0.04), std('#c0303a', 0.5), 0, 1.56, 0.265);
            [-1, 1].forEach(s => { const lapel = mk(grp, new T.BoxGeometry(0.1, 0.5, 0.04), std('#222b3a', 0.6), s * 0.14, 1.4, 0.245); lapel.rotation.z = s * 0.12; });
            mk(grp, new T.BoxGeometry(0.64, 0.07, 0.42), std('#16181d', 0.5), 0, 1.0, 0);
        } else if (spec.kind === 'robe') {
            const robe = mk(grp, new T.CylinderGeometry(0.34, 0.62, 1.15, 22), std('#4b2e83', 0.85), 0, 0.72, 0);
            robe.scale.set(1, 1, 0.8);
            mk(grp, new T.TorusGeometry(0.4, 0.035, 8, 26), std('#e6b422', 0.3, 0.8), 0, 1.0, 0).rotation.x = Math.PI / 2;
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2, y = 0.35 + (i % 4) * 0.2;
                const star = mk(grp, new T.OctahedronGeometry(0.035), std('#ffe066', 0.3, 0.3, { emissive: '#ffcc33', emissiveIntensity: 0.5 }), Math.cos(a) * (0.5 - (y - 0.3) * 0.18), y, Math.sin(a) * (0.4 - (y - 0.3) * 0.13) + (Math.sin(a) > 0 ? 0.02 : 0));
                star.castShadow = false;
            }
        } else if (spec.kind === 'ninja') {
            mk(grp, new T.BoxGeometry(0.7, 0.12, 0.44), std('#b8323a', 0.7), 0, 1.0, 0);                       // red sash
            mk(grp, new T.BoxGeometry(0.1, 0.34, 0.06), std('#b8323a', 0.7), 0.18, 0.82, 0.2);
        } else if (spec.kind === 'knight') {
            const tabard = mk(grp, new T.BoxGeometry(0.46, 0.9, 0.05), std('#2a4fa8', 0.9), 0, 1.15, 0.23);
            mk(grp, new T.BoxGeometry(0.1, 0.5, 0.06), std('#e6b422', 0.4, 0.5), 0, 1.25, 0.26);
            mk(grp, new T.BoxGeometry(0.3, 0.1, 0.06), std('#e6b422', 0.4, 0.5), 0, 1.3, 0.26);
            [-1, 1].forEach(s => mk(grp, new T.SphereGeometry(0.17, 14, 10), std('#b8c0cc', 0.3, 0.8), s * 0.42, 1.68, 0).scale.set(1, 0.7, 1));
            mk(grp, new T.BoxGeometry(0.68, 0.1, 0.42), std('#5b4a2a', 0.5, 0.4), 0, 1.0, 0);
            tabard.castShadow = false;
        } else if (spec.kind === 'astro') {
            mk(grp, new T.BoxGeometry(0.26, 0.22, 0.05), std('#2a3a55', 0.4, 0.3), 0, 1.4, 0.24);              // chest panel
            [0, 1, 2].forEach(i => mk(grp, new T.SphereGeometry(0.018, 8, 6), std(['#ff4d4d', '#ffd24d', '#4dff88'][i], 0.2, 0, { emissive: ['#ff4d4d', '#ffd24d', '#4dff88'][i], emissiveIntensity: 0.7 }), -0.07 + i * 0.07, 1.41, 0.272));
            mk(grp, new T.BoxGeometry(0.68, 0.09, 0.42), std('#ff7a1a', 0.5), 0, 1.0, 0);
            mk(grp, new T.BoxGeometry(0.42, 0.55, 0.22), std('#c9ced8', 0.5, 0.3), 0, 1.4, -0.3);             // backpack
        }

        // arms, pivoting at the shoulder
        [-1, 1].forEach(s => {
            const sh = new T.Group();
            sh.position.set(s * 0.42, 1.62, 0);
            grp.add(sh);
            const wide = spec.kind === 'robe' ? 1.5 : 1;
            const upper = mk(sh, new T.CapsuleGeometry(0.095, 0.5, 5, 10), std(spec.sleeve, spec.kind === 'knight' ? 0.3 : 0.8, spec.kind === 'knight' ? 0.8 : 0.02), 0, -0.33, 0);
            upper.scale.set(wide, 1, wide);
            mk(sh, new T.SphereGeometry(spec.kind === 'knight' ? 0.1 : 0.1, 12, 10), std(spec.hand, spec.kind === 'knight' ? 0.35 : 0.6, spec.kind === 'knight' ? 0.7 : 0.02), 0, -0.72, 0);
            sh.rotation.z = s * 0.06;
            parts[s < 0 ? 'lArm' : 'rArm'] = sh;
            if (s > 0) addTool(sh, opts.hammer && look.tool === 'none' ? Object.assign({}, look, { tool: 'hammer' }) : look);
        });

        // neck and head
        mk(grp, new T.CylinderGeometry(0.09, 0.1, 0.14, 12), skinMat, 0, 1.79, 0);
        const head = new T.Group();
        head.position.set(0, 2.02, 0);
        grp.add(head);
        const skull = mk(head, new T.SphereGeometry(0.28, 28, 22), skinMat, 0, 0, 0);
        skull.scale.set(0.98, 1.08, 0.98);
        const jaw = mk(head, new T.SphereGeometry(0.2, 20, 14), skinMat, 0, -0.1, 0.05);
        jaw.scale.set(1.05, 0.9, 0.95);

        const faceOpts = {};
        addFace(head, look, hairMat, skinMat, faceOpts);
        // ninja: mask over the lower face and a red headband
        if (spec.kind === 'ninja') {
            const mask = mk(head, new T.SphereGeometry(0.295, 22, 14, 0, Math.PI * 2, Math.PI * 0.53, Math.PI * 0.47), std('#1d2026', 0.85), 0, -0.01, 0.01);
            mask.scale.set(1, 1.1, 1.0);
            mk(head, new T.TorusGeometry(0.285, 0.035, 8, 28), std('#b8323a', 0.7), 0, 0.14, 0).rotation.x = Math.PI / 2;
        }
        addHair(head, look, hairMat);
        addHat(head, look);

        parts.head = head;
        grp.userData.parts = parts;
        grp.userData.look = look;

        // Idle motion: breathing, a blink every few seconds, and a slow head sway
        grp.userData.animateIdle = (t) => {
            const breath = Math.sin(t * 1.8);
            torso.scale.y = 1 + breath * 0.012;
            head.rotation.y = Math.sin(t * 0.6) * 0.12;
            head.rotation.x = Math.sin(t * 0.9) * 0.025;
            const phase = t % 4.2;
            const closed = phase > 3.95 && phase < 4.12 ? 1 : 0;
            (faceOpts.eyelids || []).forEach(l => { l.scale.y = closed ? 1.05 : 0.001; });
            parts.lArm.rotation.z = -0.05 + breath * 0.012;
            parts.rArm.rotation.z = 0.05 - breath * 0.012;
        };
        return grp;
    }

    // Free the GPU memory of an avatar that is being replaced
    function disposeAvatar(group) {
        if (!group) return;
        group.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
        });
    }

    // Turn what the game stores (builderCustomization, which uses shop item ids) into a look
    function lookFromCustomization(c) {
        return normalize(c);
    }

    window.AvatarFactory = { createAvatar, disposeAvatar, normalize, lookFromCustomization, OPTIONS, DEFAULT_LOOK };
})();
