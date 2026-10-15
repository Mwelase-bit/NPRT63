// Buildings.js - procedural 3D buildings, site props and characters.
// Exposes window.BuildingFactory. Every building mesh is tagged with
// userData.buildPhase (1 foundation, 2 structure, 3 roof, 4 details) so the
// scene's phase system can reveal it while the focus timer runs.
(function () {
    const T = window.THREE;

    // ── Duration tiers: longer study session = bigger building ───────────
    const TIERS = [
        { id: 'hut',        max: 10,       name: 'Log Cabin',    label: 'Tiny',   view: { scale: 1.05,  lookY: 2.0 } },
        { id: 'cottage',    max: 20,       name: 'Cottage',      label: 'Small',  view: { scale: 1.2,  lookY: 2.5 } },
        { id: 'townhouse',  max: 35,       name: 'Townhouse',    label: 'Medium', view: { scale: 1.45,  lookY: 4.0, h: 1.25 } },
        { id: 'villa',      max: 50,       name: 'Modern Villa', label: 'Medium', view: { scale: 1.55,  lookY: 3.0 } },
        { id: 'mansion',    max: 70,       name: 'Mansion',      label: 'Large',  view: { scale: 1.75, lookY: 3.5 } },
        { id: 'chalet',     max: 90,       name: 'Alpine Chalet', label: 'Large', view: { scale: 1.6,  lookY: 4.0, h: 1.05 } },
        { id: 'castle',     max: 120,      name: 'Castle',       label: 'Grand',  view: { scale: 1.85, lookY: 4.5 } },
        { id: 'skyscraper', max: Infinity, name: 'Skyscraper',   label: 'Epic',   view: { scale: 2.0, lookY: 6.5, h: 1.7 } }
    ];
    const tierFor = (minutes) => TIERS.find(t => minutes <= t.max) || TIERS[TIERS.length - 1];
    const getTier = (id) => TIERS.find(t => t.id === id) || TIERS[1];

    // ── Procedural textures (cached) ─────────────────────────────────────
    const texCache = {};
    const shade = (hex, f) => {
        const c = new T.Color(hex);
        c.multiplyScalar(f);
        return '#' + c.getHexString();
    };
    function makeTexture(kind, color) {
        const key = kind + color;
        if (texCache[key]) return texCache[key];
        const S = 128;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g = cv.getContext('2d');
        const base = '#' + new T.Color(color).getHexString();
        g.fillStyle = base;
        g.fillRect(0, 0, S, S);
        if (kind === 'brick') {
            g.fillStyle = shade(color, 0.55);
            for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 2);
            for (let y = 0, r = 0; y < S; y += 16, r++)
                for (let x = (r % 2) * 16; x < S; x += 32) g.fillRect(x, y, 2, 16);
            for (let i = 0; i < 220; i++) {
                g.fillStyle = shade(color, 0.85 + Math.random() * 0.3);
                g.fillRect(Math.random() * S, Math.random() * S, 6, 3);
            }
        } else if (kind === 'stone') {
            g.fillStyle = shade(color, 0.6);
            for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 2);
            for (let y = 0, r = 0; y < S; y += 32, r++)
                for (let x = (r % 2) * 20; x < S; x += 44) g.fillRect(x, y, 2, 32);
            for (let i = 0; i < 160; i++) {
                g.fillStyle = shade(color, 0.8 + Math.random() * 0.4);
                g.fillRect(Math.random() * S, Math.random() * S, 8, 5);
            }
        } else if (kind === 'plank') {
            for (let x = 0; x < S; x += 16) {
                g.fillStyle = shade(color, 0.88 + Math.random() * 0.22);
                g.fillRect(x, 0, 15, S);
                g.fillStyle = shade(color, 0.6);
                g.fillRect(x + 15, 0, 1, S);
            }
        } else if (kind === 'siding') {
            for (let y = 0; y < S; y += 16) {
                g.fillStyle = shade(color, 0.95 + (y % 32 ? 0.05 : 0));
                g.fillRect(0, y, S, 14);
                g.fillStyle = shade(color, 0.7);
                g.fillRect(0, y + 14, S, 2);
            }
        } else if (kind === 'shingle') {
            for (let y = 0, r = 0; y < S; y += 16, r++)
                for (let x = -(r % 2) * 12; x < S; x += 24) {
                    g.fillStyle = shade(color, 0.8 + Math.random() * 0.4);
                    g.fillRect(x, y, 22, 14);
                    g.fillStyle = shade(color, 0.55);
                    g.fillRect(x, y + 14, 22, 2);
                }
        } else if (kind === 'plaster') {
            for (let i = 0; i < 300; i++) {
                g.fillStyle = shade(color, 0.94 + Math.random() * 0.1);
                g.fillRect(Math.random() * S, Math.random() * S, 4, 4);
            }
        } else if (kind === 'glass') {
            g.fillStyle = '#1b3a57';
            g.fillRect(0, 0, S, S);
            for (let y = 6; y < S; y += 32)
                for (let x = 6; x < S; x += 32) {
                    g.fillStyle = (x + y) % 64 === 12 ? '#9fd8ff' : '#4f93c9';
                    g.fillRect(x, y, 26, 24);
                }
        }
        const tex = new T.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = T.RepeatWrapping;
        if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
        texCache[key] = tex;
        return tex;
    }

    // Fresh material every call: the phase system fades each mesh independently.
    function mat(color, opts) {
        opts = opts || {};
        const o = { color: opts.map ? 0xffffff : color, roughness: 0.82, metalness: 0.04 };
        if (opts.map) {
            const base = makeTexture(opts.map, color);
            const tex = base.clone();
            tex.needsUpdate = true;
            tex.repeat.set(opts.rx || 1, opts.ry || 1);
            o.map = tex;
        }
        if (opts.rough !== undefined) o.roughness = opts.rough;
        if (opts.metal !== undefined) o.metalness = opts.metal;
        if (opts.emissive) { o.emissive = opts.emissive; o.emissiveIntensity = opts.ei || 0.6; }
        return new T.MeshStandardMaterial(o);
    }

    // ── Mesh helpers ─────────────────────────────────────────────────────
    function add(g, geo, material, x, y, z, phase, ry) {
        const m = new T.Mesh(geo, material);
        m.position.set(x, y, z);
        if (ry) m.rotation.y = ry;
        m.castShadow = true;
        m.receiveShadow = true;
        if (phase) m.userData.buildPhase = phase;
        g.add(m);
        return m;
    }
    const box = (g, w, h, d, x, y, z, phase, material, ry) => add(g, new T.BoxGeometry(w, h, d), material, x, y, z, phase, ry);
    const cyl = (g, rt, rb, h, seg, x, y, z, phase, material) => add(g, new T.CylinderGeometry(rt, rb, h, seg), material, x, y, z, phase);

    // Wall block with a repeating texture sized to its dimensions
    const wall = (g, w, h, d, x, y, z, phase, color, kind) =>
        box(g, w, h, d, x, y, z, phase, mat(color, { map: kind, rx: Math.max(1, Math.round(Math.max(w, d) / 2)), ry: Math.max(1, Math.round(h / 2)) }));

    // Gabled roof, ridge along X by default (ry = PI/2 to turn it)
    function gable(g, w, h, d, over, x, y, z, color, phase, ry) {
        const sh = new T.Shape();
        sh.moveTo(-d / 2 - over, 0);
        sh.lineTo(d / 2 + over, 0);
        sh.lineTo(0, h);
        sh.closePath();
        const geo = new T.ExtrudeGeometry(sh, { depth: w + over * 2, bevelEnabled: false });
        geo.translate(0, 0, -(w + over * 2) / 2);
        geo.rotateY(Math.PI / 2); // ridge along X
        const m = add(g, geo, mat(color, { rough: 0.7 }), x, y, z, phase, ry);
        // ridge cap
        const cap = box(g, w + over * 2 + 0.1, 0.12, 0.28, x, y + h, z, phase, mat(shade(color, 0.7)), ry);
        return m;
    }
    function hipRoof(g, w, d, h, x, y, z, color, phase) {
        const geo = new T.ConeGeometry(1, h, 4);
        geo.rotateY(Math.PI / 4);
        const m = add(g, geo, mat(color, { rough: 0.7 }), x, y + h / 2, z, phase);
        m.scale.set(w / 1.4142, 1, d / 1.4142);
        return m;
    }

    // Window with frame, glass, cross bars, sill and optional shutters. Faces +Z (rotate with ry).
    function windowAt(g, x, y, z, w, h, ry, phase, shutters) {
        const grp = new T.Group();
        grp.position.set(x, y, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        box(grp, w + 0.18, h + 0.18, 0.12, 0, 0, 0, phase, mat(0xF4F1E8));
        box(grp, w, h, 0.14, 0, 0, 0.02, phase, mat(0x6fb6e6, { rough: 0.1, metal: 0.6, emissive: 0x1d4f7a, ei: 0.25 }));
        box(grp, 0.06, h, 0.16, 0, 0, 0.03, phase, mat(0xF4F1E8));
        box(grp, w, 0.06, 0.16, 0, 0, 0.03, phase, mat(0xF4F1E8));
        box(grp, w + 0.34, 0.08, 0.26, 0, -h / 2 - 0.12, 0.08, phase, mat(0xE8E2D4));
        if (shutters) {
            [-1, 1].forEach(s => box(grp, 0.22, h + 0.1, 0.08, s * (w / 2 + 0.26), 0, 0.02, phase, mat(shutters)));
        }
        return grp;
    }
    // Door with frame, panels, knob. Faces +Z.
    function doorAt(g, x, y, z, w, h, color, ry, phase) {
        const grp = new T.Group();
        grp.position.set(x, y, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        box(grp, w + 0.3, h + 0.15, 0.14, 0, h / 2, 0, phase, mat(0xF4F1E8));
        box(grp, w, h, 0.18, 0, h / 2, 0.02, phase, mat(color, { map: 'plank', rx: 1, ry: 1 }));
        box(grp, w * 0.7, h * 0.35, 0.05, 0, h * 0.7, 0.12, phase, mat(shade(color, 0.8)));
        box(grp, w * 0.7, h * 0.35, 0.05, 0, h * 0.28, 0.12, phase, mat(shade(color, 0.8)));
        add(grp, new T.SphereGeometry(0.06, 10, 8), mat(0xD4AF37, { metal: 0.8, rough: 0.3 }), w * 0.32, h * 0.5, 0.14, phase);
        return grp;
    }
    function steps(g, w, n, x, z, phase, color) {
        for (let i = 0; i < n; i++) box(g, w, 0.18, 0.5, x, 0.09 + i * 0.18, z + (n - 1 - i) * 0.45, phase, mat(color || 0xA9A9A9, { map: 'stone' }));
    }
    function chimney(g, x, y, z, h, phase, color) {
        box(g, 0.7, h, 0.7, x, y + h / 2, z, phase, mat(color || 0x9a4b3a, { map: 'brick', rx: 1, ry: 2 }));
        box(g, 0.9, 0.16, 0.9, x, y + h, z, phase, mat(0x6b6b6b));
    }
    function pineTree(g, x, z, s, phase) {
        cyl(g, 0.12 * s, 0.18 * s, 0.9 * s, 6, x, 0.45 * s, z, phase, mat(0x6b4226));
        [0, 1, 2].forEach(i => add(g, new T.ConeGeometry((1.0 - i * 0.25) * s, 1.1 * s, 8), mat(0x2f7d3a + i * 0x050a05, { rough: 0.9 }), x, (1.2 + i * 0.75) * s, z, phase));
    }
    function roundTree(g, x, z, s, phase) {
        cyl(g, 0.14 * s, 0.2 * s, 1.2 * s, 6, x, 0.6 * s, z, phase, mat(0x6b4226));
        add(g, new T.IcosahedronGeometry(0.95 * s, 1), mat(0x3f9b4a, { rough: 0.95 }), x, 1.9 * s, z, phase);
    }
    function palm(g, x, z, s, phase) {
        cyl(g, 0.1 * s, 0.16 * s, 2.6 * s, 6, x, 1.3 * s, z, phase, mat(0x8a6a45));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const leaf = add(g, new T.ConeGeometry(0.2 * s, 1.5 * s, 4), mat(0x3aa14a), x + Math.cos(a) * 0.55 * s, 2.55 * s, z + Math.sin(a) * 0.55 * s, phase);
            leaf.rotation.z = -Math.cos(a) * 1.1;
            leaf.rotation.x = Math.sin(a) * 1.1;
        }
    }
    function bush(g, x, z, s, phase, color) {
        add(g, new T.IcosahedronGeometry(0.4 * s, 1), mat(color || 0x3d8f45, { rough: 0.95 }), x, 0.3 * s, z, phase);
    }
    function flowerBed(g, x, z, w, phase) {
        box(g, w, 0.18, 0.5, x, 0.09, z, phase, mat(0x5b3a24));
        const cols = [0xFF6B9D, 0xFFD166, 0xFFFFFF, 0xDA70D6];
        for (let i = 0; i < Math.floor(w / 0.35); i++)
            add(g, new T.SphereGeometry(0.09, 6, 6), mat(cols[i % 4]), x - w / 2 + 0.25 + i * 0.35, 0.25, z, phase);
    }
    function picketFence(g, x, z, len, ry, phase) {
        const f = new T.Group();
        f.position.set(x, 0, z);
        f.rotation.y = ry || 0;
        g.add(f);
        for (let i = 0; i < len / 0.35; i++) box(f, 0.14, 0.7, 0.05, -len / 2 + i * 0.35, 0.35, 0, phase, mat(0xFAF7F0));
        box(f, len, 0.07, 0.05, 0, 0.5, 0, phase, mat(0xFAF7F0));
        box(f, len, 0.07, 0.05, 0, 0.2, 0, phase, mat(0xFAF7F0));
    }
    function lampPost(g, x, z, phase) {
        cyl(g, 0.05, 0.07, 2.2, 6, x, 1.1, z, phase, mat(0x2b2b2b, { metal: 0.6 }));
        add(g, new T.SphereGeometry(0.18, 10, 8), mat(0xFFF2B0, { emissive: 0xffd966, ei: 0.9 }), x, 2.3, z, phase);
    }
    function base(g, w, d, h, color) {
        return box(g, w, h, d, 0, h / 2, 0, 1, mat(color || 0x8d8d8d, { map: 'stone', rx: Math.round(w / 2), ry: 1 }));
    }

    // ── 1. Log cabin ─────────────────────────────────────────────────────
    function logCabin(g) {
        base(g, 4.6, 4.2, 0.25, 0x7a7a7a);
        box(g, 3.8, 0.2, 3.4, 0, 0.35, 0, 1, mat(0x5b3a24, { map: 'plank' }));
        wall(g, 3.6, 2.4, 3.2, 0, 1.55, 0, 2, 0x9b6a3c, 'plank');
        for (let i = 0; i < 4; i++) {            // log ends at the corners
            const x = i < 2 ? -1.8 : 1.8, z = i % 2 ? -1.6 : 1.6;
            cyl(g, 0.16, 0.16, 2.5, 8, x, 1.55, z, 2, mat(0x7a4f2b));
        }
        gable(g, 3.6, 1.5, 3.2, 0.5, 0, 2.75, 0, 0x6e4b2a, 3);
        chimney(g, 1.2, 3.1, -0.8, 1.6, 3, 0x8a8a8a);
        doorAt(g, 0, 0.25, 1.62, 0.9, 1.7, 0x5a3a1e, 0, 2);
        windowAt(g, -1.2, 1.7, 1.62, 0.7, 0.7, 0, 4, 0x3c6e47);
        windowAt(g, 1.2, 1.7, 1.62, 0.7, 0.7, 0, 4, 0x3c6e47);
        windowAt(g, 1.82, 1.7, 0, 0.7, 0.7, Math.PI / 2, 4);
        box(g, 2.0, 0.12, 1.0, 0, 0.3, 2.35, 4, mat(0x6b4a2a, { map: 'plank' }));      // porch
        [-0.9, 0.9].forEach(x => cyl(g, 0.07, 0.07, 1.8, 6, x, 1.2, 2.7, 4, mat(0x6b4a2a)));
        box(g, 2.2, 0.1, 1.1, 0, 2.1, 2.3, 4, mat(0x6e4b2a));
        for (let i = 0; i < 6; i++) cyl(g, 0.12, 0.12, 1.1, 8, 1.9 + (i % 3) * 0.26, 0.45 + Math.floor(i / 3) * 0.24, -1.4, 4, mat(0x8a5a30)).rotation.z = Math.PI / 2;
        cyl(g, 0.3, 0.26, 0.6, 10, -2.3, 0.3, 1.8, 4, mat(0x7a4f2b));                   // barrel
        pineTree(g, -3.2, -1.5, 1.1, 4);
        pineTree(g, 3.3, 0.8, 0.9, 4);
        bush(g, -1.9, 2.0, 1, 4);
    }

    // ── 2. Cottage ───────────────────────────────────────────────────────
    function cottage(g) {
        base(g, 5.4, 4.8, 0.3, 0x808080);
        wall(g, 5.0, 3.0, 4.4, 0, 1.8, 0, 2, 0xF3E3C3, 'plaster');
        box(g, 5.1, 0.25, 4.5, 0, 0.45, 0, 2, mat(0x8b7d6b, { map: 'stone', rx: 3, ry: 1 }));
        [[-2.5, 2.2], [2.5, 2.2], [-2.5, -2.2], [2.5, -2.2]].forEach(p => box(g, 0.25, 3.05, 0.25, p[0], 1.82, p[1], 2, mat(0x8b5a2b)));
        gable(g, 5.0, 2.3, 4.4, 0.6, 0, 3.3, 0, 0xB23A2E, 3);
        chimney(g, -1.6, 4.0, -0.6, 2.0, 3);
        doorAt(g, 0, 0.3, 2.25, 1.1, 2.0, 0x2e6b8f, 0, 2);
        windowAt(g, -1.6, 2.0, 2.24, 1.0, 1.0, 0, 4, 0x2e6b8f);
        windowAt(g, 1.6, 2.0, 2.24, 1.0, 1.0, 0, 4, 0x2e6b8f);
        windowAt(g, 2.52, 2.0, 0, 1.0, 1.0, Math.PI / 2, 4);
        windowAt(g, -2.52, 2.0, 0.2, 1.0, 1.0, -Math.PI / 2, 4);
        steps(g, 1.6, 2, 0, 2.5, 4);
        box(g, 1.8, 0.1, 0.9, 0, 2.55, 2.6, 4, mat(0xB23A2E));                                // door awning
        flowerBed(g, -1.6, 2.55, 1.5, 4);
        flowerBed(g, 1.6, 2.55, 1.5, 4);
        picketFence(g, 0, 4.1, 5.0, 0, 4);
        picketFence(g, -2.9, 2.3, 3.6, Math.PI / 2, 4);
        picketFence(g, 2.9, 2.3, 3.6, Math.PI / 2, 4);
        roundTree(g, -3.8, -1.2, 1.1, 4);
        bush(g, 3.4, -0.5, 1.2, 4, 0x4aa14f);
        lampPost(g, 1.9, 3.4, 4);
    }

    // ── 3. Townhouse ─────────────────────────────────────────────────────
    function townhouse(g) {
        base(g, 6.4, 5.4, 0.35, 0x6f6f6f);
        wall(g, 6.0, 3.4, 5.0, 0, 2.05, 0, 2, 0xB5533C, 'brick');
        wall(g, 6.0, 3.2, 5.0, 0, 5.65, 0, 2, 0xB5533C, 'brick');
        box(g, 6.2, 0.22, 5.2, 0, 3.8, 0, 2, mat(0xEDE6D6));                                  // floor band
        box(g, 6.2, 0.22, 5.2, 0, 0.45, 0, 2, mat(0xEDE6D6));
        [[-3, 2.5], [3, 2.5], [-3, -2.5], [3, -2.5]].forEach(p => box(g, 0.3, 6.9, 0.3, p[0], 3.8, p[1], 2, mat(0xEDE6D6)));
        gable(g, 6.0, 2.2, 5.0, 0.5, 0, 7.25, 0, 0x4a4a55, 3, Math.PI / 2);
        chimney(g, 2.0, 8.0, -1.4, 1.6, 3);
        chimney(g, -2.0, 8.0, -1.4, 1.6, 3);
        doorAt(g, 0, 0.35, 2.55, 1.2, 2.2, 0x1e3a5f, 0, 2);
        steps(g, 2.0, 3, 0, 2.7, 4);
        box(g, 2.2, 0.12, 1.2, 0, 2.75, 3.1, 4, mat(0x3a3a44));
        [-0.95, 0.95].forEach(x => cyl(g, 0.07, 0.07, 2.4, 6, x, 1.55, 3.55, 4, mat(0xEDE6D6)));
        [-2.1, 2.1].forEach(x => windowAt(g, x, 2.3, 2.54, 1.1, 1.5, 0, 4, 0x1e3a5f));
        [-2.1, 0, 2.1].forEach(x => windowAt(g, x, 5.7, 2.54, 1.1, 1.5, 0, 4, 0x1e3a5f));
        [-1.4, 1.4].forEach(z => { windowAt(g, 3.02, 2.3, z, 1.0, 1.4, Math.PI / 2, 4); windowAt(g, 3.02, 5.7, z, 1.0, 1.4, Math.PI / 2, 4); });
        // balcony
        box(g, 3.2, 0.14, 1.0, 0, 3.9, 3.0, 4, mat(0x888888, { map: 'stone' }));
        for (let i = 0; i < 9; i++) cyl(g, 0.035, 0.035, 0.8, 5, -1.5 + i * 0.375, 4.4, 3.45, 4, mat(0x222222, { metal: 0.7 }));
        box(g, 3.2, 0.07, 0.07, 0, 4.82, 3.45, 4, mat(0x222222, { metal: 0.7 }));
        // garage wing
        wall(g, 2.8, 2.4, 3.6, 4.6, 1.5, 0.4, 2, 0xC9B79C, 'siding');
        gable(g, 2.8, 0.9, 3.6, 0.3, 4.6, 2.7, 0.4, 0x4a4a55, 3, Math.PI / 2);
        box(g, 2.0, 1.8, 0.1, 4.6, 1.1, 2.25, 4, mat(0xdadada, { map: 'siding', rx: 2, ry: 2 }));
        roundTree(g, -4.4, 2.0, 1.0, 4);
        bush(g, -3.4, 3.1, 1.1, 4); bush(g, 3.6, 3.2, 1.0, 4);
        lampPost(g, -1.9, 3.7, 4);
    }

    // ── 4. Modern villa ──────────────────────────────────────────────────
    function villa(g) {
        base(g, 9.4, 6.4, 0.3, 0xb5b5b5);
        const wh = 0xF2F2EE;
        wall(g, 5.2, 3.0, 4.4, -1.6, 1.8, -0.4, 2, wh, 'plaster');
        wall(g, 4.0, 2.7, 3.8, 2.8, 1.65, 0.2, 2, 0xE5E2DA, 'plaster');
        wall(g, 3.4, 2.6, 3.4, -2.2, 4.4, -0.6, 2, wh, 'plaster');                           // upper box
        // glass facades
        box(g, 3.2, 2.2, 0.1, -1.6, 1.8, 1.85, 2, mat(0x5aa7d8, { rough: 0.05, metal: 0.7, emissive: 0x1b4a73, ei: 0.35 }));
        box(g, 2.6, 2.0, 0.1, 2.8, 1.7, 2.15, 2, mat(0x5aa7d8, { rough: 0.05, metal: 0.7, emissive: 0x1b4a73, ei: 0.35 }));
        box(g, 2.6, 1.8, 0.1, -2.2, 4.4, 1.15, 2, mat(0x5aa7d8, { rough: 0.05, metal: 0.7, emissive: 0x1b4a73, ei: 0.35 }));
        [-3.2, -0.0].forEach(x => box(g, 0.08, 2.2, 0.14, x, 1.8, 1.9, 4, mat(0x222222)));
        box(g, 1.2, 2.7, 0.2, 0.9, 1.65, 1.95, 4, mat(0x9b6a3c, { map: 'plank' }));        // wood accent
        // flat roofs with overhang
        box(g, 5.8, 0.25, 5.0, -1.6, 3.42, -0.4, 3, mat(0x2f2f33));
        box(g, 4.6, 0.25, 4.4, 2.8, 3.1, 0.2, 3, mat(0x2f2f33));
        box(g, 4.0, 0.25, 4.0, -2.2, 5.82, -0.6, 3, mat(0x2f2f33));
        box(g, 2.2, 0.08, 1.2, 0.9, 3.0, 2.7, 4, mat(0x2f2f33));                              // porch canopy
        doorAt(g, 0.9, 0.3, 2.07, 1.0, 2.0, 0x2b2b2e, 0, 4);
        steps(g, 1.8, 2, 0.9, 2.3, 4, 0xcfcfcf);
        // pool
        box(g, 4.0, 0.12, 2.0, 2.4, 0.18, 4.0, 4, mat(0xE8E8E8));
        box(g, 3.6, 0.1, 1.6, 2.4, 0.26, 4.0, 4, mat(0x3fb6e8, { rough: 0.05, metal: 0.3, emissive: 0x1a86b8, ei: 0.5 }));
        // loungers
        [-0.2, 0.3].forEach((o, i) => box(g, 0.5, 0.1, 1.1, 4.8 + 0, 0.25, 3.6 + i * 0.8, 4, mat(0xffffff)));
        palm(g, 4.6, -2.4, 1.1, 4); palm(g, -4.4, 2.2, 1.0, 4);
        bush(g, -0.2, 3.1, 1.0, 4, 0x2e7d46); bush(g, 0.5, 3.2, 0.9, 4, 0x2e7d46);
        lampPost(g, -2.8, 3.2, 4);
    }

    // ── 5. Mansion ───────────────────────────────────────────────────────
    function mansion(g) {
        base(g, 13.4, 6.8, 0.4, 0x7a7a7a);
        const stone = 0xE6DCC6;
        wall(g, 6.4, 5.0, 4.8, 0, 2.9, 0, 2, stone, 'plaster');
        wall(g, 3.8, 4.0, 4.2, -5.0, 2.4, 0.2, 2, stone, 'plaster');
        wall(g, 3.8, 4.0, 4.2, 5.0, 2.4, 0.2, 2, stone, 'plaster');
        box(g, 6.6, 0.2, 5.0, 0, 5.4, 0, 2, mat(0xCFC4A8));
        [-5, 5].forEach(x => box(g, 4.0, 0.2, 4.4, x, 4.4, 0.2, 2, mat(0xCFC4A8)));
        // roofs
        hipRoof(g, 7.2, 5.6, 3.0, 0, 5.5, 0, 0x45505c, 3);
        [-5, 5].forEach(x => hipRoof(g, 4.6, 5.0, 2.4, x, 4.5, 0.2, 0x45505c, 3));
        [-2, 2].forEach(x => { chimney(g, x, 6.2, -1.4, 1.6, 3); });
        // portico with columns and pediment
        box(g, 4.2, 0.3, 1.8, 0, 0.55, 3.3, 2, mat(0xD9D0BB));
        for (let i = 0; i < 4; i++) {
            const x = -1.6 + i * (3.2 / 3);
            cyl(g, 0.22, 0.26, 3.6, 12, x, 2.5, 3.9, 2, mat(0xF6F2E8, { rough: 0.5 }));
            cyl(g, 0.34, 0.34, 0.18, 12, x, 0.8, 3.9, 2, mat(0xE0D8C4));
            cyl(g, 0.34, 0.3, 0.18, 12, x, 4.4, 3.9, 2, mat(0xE0D8C4));
        }
        box(g, 4.4, 0.35, 2.0, 0, 4.65, 3.3, 3, mat(0xF0EADB));
        gable(g, 4.0, 0.9, 2.0, 0.2, 0, 4.82, 3.35, 0xEFE8D6, 3, Math.PI / 2);
        doorAt(g, 0, 0.55, 2.43, 1.4, 2.8, 0x6b1f24, 0, 4);
        steps(g, 3.2, 3, 0, 4.2, 4, 0xd8d0bd);
        [-2.2, 2.2].forEach(x => { windowAt(g, x, 3.4, 2.42, 1.0, 1.7, 0, 4, 0x2d4a3e); });
        [-2.2, 0, 2.2].forEach(x => windowAt(g, x, 5.0, 2.42, 0.9, 1.0, 0, 4));
        [-5, 5].forEach(x => { [-0.8, 0.8].forEach(dx => { windowAt(g, x + dx, 1.9, 2.32, 0.9, 1.5, 0, 4, 0x2d4a3e); windowAt(g, x + dx, 3.5, 2.32, 0.9, 1.1, 0, 4); }); });
        // formal garden: hedges + fountain
        [-1, 1].forEach(s => box(g, 3.0, 0.8, 0.7, s * 3.2, 0.4, 5.2, 4, mat(0x2f6f3a, { rough: 0.95 })));
        cyl(g, 0.9, 1.0, 0.35, 16, 0, 0.2, 5.6, 4, mat(0xbfbfbf, { map: 'stone', rx: 3, ry: 1 }));
        cyl(g, 0.7, 0.7, 0.1, 16, 0, 0.4, 5.6, 4, mat(0x3fb6e8, { rough: 0.05, metal: 0.3, emissive: 0x1a86b8, ei: 0.5 }));
        cyl(g, 0.12, 0.16, 0.9, 8, 0, 0.8, 5.6, 4, mat(0xbfbfbf));
        roundTree(g, -6.8, 3.4, 1.2, 4); roundTree(g, 6.8, 3.4, 1.2, 4);
        lampPost(g, -3.2, 4.3, 4); lampPost(g, 3.2, 4.3, 4);
    }

    // ── 6. Alpine chalet ─────────────────────────────────────────────────
    // Steep snow-covered A-frame roof, glazed gable, balcony, stone chimney.
    function snowPine(g, x, z, s, phase) {
        cyl(g, 0.13 * s, 0.19 * s, 0.9 * s, 6, x, 0.45 * s, z, phase, mat(0x5b3d26));
        [0, 1, 2, 3].forEach(i => {
            const r = (1.15 - i * 0.24) * s, h = 1.0 * s, y = (1.0 + i * 0.7) * s;
            add(g, new T.ConeGeometry(r, h, 8), mat(0x24683a, { rough: 0.95 }), x, y, z, phase);
            add(g, new T.ConeGeometry(r * 0.78, h * 0.55, 8), mat(0xf6f9fc, { rough: 1 }), x, y + h * 0.2, z, phase);
        });
    }

    // Pitched roof built from two slabs so the front stays open to show the glazed gable.
    // Ridge runs along Z; `span` is the width across X, `len` the depth along Z.
    function chaletRoof(g, span, h, len, over, y, color, phase) {
        const half = span / 2 + over;
        const ang = Math.atan2(h, half);
        const L = Math.hypot(half, h) + 0.2;
        const W = len + over * 2;
        const ny = Math.cos(ang), nx = Math.sin(ang);
        [-1, 1].forEach(s => {
            const cx = s * half / 2, cy = y + h / 2;
            const slab = box(g, L, 0.22, W, cx, cy, 0, phase, mat(color, { map: 'shingle', rx: 4, ry: 3 }));
            slab.rotation.z = -s * ang;
            // snow blanket, set back from the eaves so the dark roof edge shows
            const snow = box(g, L - 0.5, 0.2, W - 0.35, cx + s * nx * 0.2, cy + ny * 0.2, 0, phase, mat(0xf7fafc, { rough: 1 }));
            snow.rotation.z = -s * ang;
            // bargeboards along the front and back edges
            [-1, 1].forEach(e => {
                const bb = box(g, L + 0.05, 0.3, 0.12, cx, cy - 0.03, e * (W / 2), phase, mat(0x4a2f1c));
                bb.rotation.z = -s * ang;
            });
        });
        box(g, 0.5, 0.18, W + 0.05, 0, y + h + 0.12, 0, phase, mat(0xf7fafc, { rough: 1 }));   // snowy ridge
    }

    function chalet(g) {
        const timber = 0x9a6032, darkTimber = 0x4a2f1c, shutter = 0x7d2b2b;
        base(g, 7.2, 5.2, 0.3, 0x707377);
        // stone ground floor + log band + timber upper floor
        wall(g, 6.4, 2.0, 4.4, 0, 1.3, 0, 2, 0x8f8b84, 'stone');
        box(g, 6.6, 0.2, 4.6, 0, 2.4, 0, 2, mat(darkTimber, { map: 'plank', rx: 4, ry: 1 }));
        wall(g, 6.0, 2.4, 4.0, 0, 3.7, 0, 2, timber, 'plank');
        [[-3.0, 2.0], [3.0, 2.0], [-3.0, -2.0], [3.0, -2.0]].forEach(p => box(g, 0.28, 2.5, 0.28, p[0], 3.7, p[1], 2, mat(darkTimber)));

        // glazed A-frame gable on the front (triangle between the upper wall and the roof)
        const top = 4.9, ridge = 7.8;
        const tri = new T.Shape();
        tri.moveTo(-3.0, top); tri.lineTo(3.0, top); tri.lineTo(3.0, top + 0.7); tri.lineTo(0, ridge - 0.1); tri.lineTo(-3.0, top + 0.7); tri.closePath();
        const triGeo = new T.ExtrudeGeometry(tri, { depth: 0.22, bevelEnabled: false });
        add(g, triGeo, mat(timber, { map: 'plank', rx: 3, ry: 2 }), 0, 0, 1.9, 3);
        const glass = new T.Shape();
        glass.moveTo(-2.2, top + 0.2); glass.lineTo(2.2, top + 0.2); glass.lineTo(2.2, top + 0.85); glass.lineTo(0, ridge - 0.65); glass.lineTo(-2.2, top + 0.85); glass.closePath();
        add(g, new T.ExtrudeGeometry(glass, { depth: 0.12, bevelEnabled: false }),
            mat(0x8cc8f2, { rough: 0.05, metal: 0.45, emissive: 0xffb347, ei: 0.2 }), 0, 0, 2.08, 4);
        box(g, 0.1, ridge - top - 0.8, 0.2, 0, (top + ridge) / 2 - 0.15, 2.14, 4, mat(darkTimber));                // mullions
        box(g, 4.4, 0.1, 0.2, 0, top + 0.95, 2.14, 4, mat(darkTimber));
        box(g, 3.0, 0.1, 0.2, 0, top + 1.75, 2.14, 4, mat(darkTimber));

        chaletRoof(g, 6.0, ridge - top, 4.0, 1.0, top, 0x3e3a3c, 3);

        // stone chimney with snow cap
        box(g, 1.0, 7.4, 1.0, 3.6, 3.7, -0.4, 2, mat(0x85817a, { map: 'stone', rx: 1, ry: 6 }));
        box(g, 1.3, 0.2, 1.3, 3.6, 7.5, -0.4, 3, mat(0xf7fafc, { rough: 1 }));
        box(g, 0.6, 0.35, 0.6, 3.6, 7.72, -0.4, 3, mat(0x3a3a3a));

        // front door under the balcony + steps
        doorAt(g, 0, 0.3, 2.22, 1.15, 1.9, 0x4a2c17, 0, 2);
        steps(g, 1.7, 3, 0, 2.55, 4, 0x9a9a95);
        [-2.0, 2.0].forEach(x => windowAt(g, x, 1.45, 2.22, 0.9, 0.95, 0, 4, shutter));
        [-1.0, 1.0].forEach(z => { windowAt(g, 3.22, 1.45, z, 0.9, 0.95, Math.PI / 2, 4); windowAt(g, -3.22, 1.45, z, 0.9, 0.95, -Math.PI / 2, 4, shutter); });
        [-1.6, 1.6].forEach(x => windowAt(g, x, 3.75, 2.02, 0.85, 1.15, 0, 4, shutter));
        windowAt(g, -3.02, 3.75, 0, 0.9, 1.15, -Math.PI / 2, 4, shutter);

        // balcony with railing + two support posts
        box(g, 5.4, 0.16, 1.1, 0, 2.58, 2.55, 4, mat(darkTimber, { map: 'plank', rx: 3, ry: 1 }));
        [-2.65, 2.65].forEach(x => cyl(g, 0.1, 0.1, 2.5, 6, x, 1.3, 3.05, 4, mat(darkTimber)));
        for (let i = 0; i < 10; i++) box(g, 0.07, 0.8, 0.07, -2.5 + i * (5.0 / 9), 3.05, 3.05, 4, mat(darkTimber));
        box(g, 5.4, 0.09, 0.1, 0, 3.47, 3.05, 4, mat(darkTimber));
        [-1, 1].forEach(s => { box(g, 0.1, 0.09, 1.1, s * 2.7, 3.47, 2.55, 4, mat(darkTimber)); });

        // firewood stack along the left wall, skis by the door, lantern
        [[4, 0.22], [3, 0.5], [2, 0.78], [1, 1.06]].forEach(([n, y]) => {
            for (let i = 0; i < n; i++) cyl(g, 0.16, 0.16, 2.0, 8, -3.85 + (i - (n - 1) / 2) * 0.33, y, -0.2, 4, mat(0x8a5a30)).rotation.x = Math.PI / 2;
        });
        [0, 1].forEach(i => { const ski = box(g, 0.12, 2.1, 0.03, -1.6 + i * 0.22, 1.1, 2.4, 4, mat(i ? 0xc0392b : 0x2c6fbb)); ski.rotation.z = 0.12; ski.rotation.x = 0.08; });
        lampPost(g, 1.9, 3.5, 4);
        snowPine(g, -5.0, -1.6, 1.5, 4);
        snowPine(g, 5.6, 2.2, 1.25, 4);
        snowPine(g, -4.4, 3.0, 1.0, 4);
        add(g, new T.IcosahedronGeometry(0.5, 1), mat(0xf4f8fb, { rough: 1 }), -2.6, 0.2, 3.2, 4);                    // snow drifts
        add(g, new T.IcosahedronGeometry(0.7, 1), mat(0xf4f8fb, { rough: 1 }), 3.0, 0.25, 3.0, 4);
    }

    // ── 7. Castle ────────────────────────────────────────────────────────
    function crenellations(g, len, x, y, z, ry, color) {
        const grp = new T.Group();
        grp.position.set(x, y, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        const n = Math.floor(len / 0.9);
        for (let i = 0; i < n; i++) box(grp, 0.5, 0.5, 0.5, -len / 2 + 0.45 + i * 0.9, 0.25, 0, 3, mat(color, { map: 'stone', rx: 1, ry: 1 }));
    }
    function roundTower(g, x, z, h, r, roofColor) {
        cyl(g, r, r * 1.08, h, 18, x, h / 2 + 0.4, z, 2, mat(0x8e949c, { map: 'stone', rx: 4, ry: Math.round(h / 2) }));
        cyl(g, r + 0.18, r + 0.18, 0.3, 18, x, h + 0.55, z, 3, mat(0x7a8087, { map: 'stone', rx: 4, ry: 1 }));
        cyl(g, 0, r + 0.3, h * 0.55, 18, x, h + 0.7 + h * 0.275, z, 3, mat(roofColor, { rough: 0.6 }));
        // arrow slit
        box(g, 0.1, 0.6, 0.1, x, h * 0.6, z + r + 0.02, 4, mat(0x15151a));
        // flag
        cyl(g, 0.03, 0.03, 1.2, 5, x, h + 0.7 + h * 0.55 + 0.5, z, 4, mat(0x444444));
        const fl = box(g, 0.7, 0.4, 0.04, x + 0.38, h + 0.7 + h * 0.55 + 0.85, z, 4, mat(0xC0392B));
    }
    function castle(g) {
        base(g, 11.6, 11.6, 0.5, 0x6e6e6e);
        const s = 0x9aa0a8;
        // curtain walls
        wall(g, 8.2, 3.4, 0.8, 0, 2.2, 5.0, 2, s, 'stone');
        wall(g, 8.2, 3.4, 0.8, 0, 2.2, -5.0, 2, s, 'stone');
        wall(g, 0.8, 3.4, 8.2, 5.0, 2.2, 0, 2, s, 'stone');
        wall(g, 0.8, 3.4, 8.2, -5.0, 2.2, 0, 2, s, 'stone');
        crenellations(g, 8.2, 0, 4.15, 5.0, 0, s);
        crenellations(g, 8.2, 0, 4.15, -5.0, 0, s);
        crenellations(g, 8.2, 5.0, 4.15, 0, Math.PI / 2, s);
        crenellations(g, 8.2, -5.0, 4.15, 0, Math.PI / 2, s);
        // corner towers
        [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(p => roundTower(g, p[0], p[1], 5.6, 1.4, 0x7a2d2d));
        // gatehouse
        wall(g, 3.2, 4.6, 1.6, 0, 2.7, 5.2, 2, 0x8e949c, 'stone');
        box(g, 1.6, 2.6, 0.3, 0, 1.7, 6.05, 4, mat(0x1a1410));
        cyl(g, 0.8, 0.8, 0.3, 12, 0, 3.0, 6.05, 4, mat(0x1a1410)).rotation.x = Math.PI / 2;
        for (let i = 0; i < 6; i++) box(g, 0.06, 2.6, 0.06, -0.65 + i * 0.26, 1.7, 6.25, 4, mat(0x333333, { metal: 0.7 }));   // portcullis
        crenellations(g, 3.2, 0, 5.25, 5.2, 0, 0x8e949c);
        [-1.9, 1.9].forEach(x => cyl(g, 0.4, 0.4, 5.0, 10, x, 2.9, 6.0, 2, mat(0x8a9098, { map: 'stone', rx: 2, ry: 2 })));
        // drawbridge
        box(g, 1.6, 0.12, 2.4, 0, 0.35, 7.3, 4, mat(0x6b4a2a, { map: 'plank' }));
        // central keep
        wall(g, 4.2, 6.4, 4.2, 0, 3.7, -0.2, 2, 0xa5abb3, 'stone');
        crenellations(g, 4.2, 0, 6.9, 1.9, 0, 0xa5abb3);
        crenellations(g, 4.2, 0, 6.9, -2.3, 0, 0xa5abb3);
        crenellations(g, 4.2, 1.9, 6.9, -0.2, Math.PI / 2, 0xa5abb3);
        crenellations(g, 4.2, -1.9, 6.9, -0.2, Math.PI / 2, 0xa5abb3);
        [[-1.9, -2.2], [1.9, -2.2], [-1.9, 1.8], [1.9, 1.8]].forEach(p => cyl(g, 0.5, 0.55, 7.0, 10, p[0], 3.9, p[1], 2, mat(0x9aa0a8, { map: 'stone', rx: 2, ry: 3 })));
        cyl(g, 0, 1.0, 1.6, 8, 0, 8.3, -0.2, 3, mat(0x7a2d2d));
        cyl(g, 0.03, 0.03, 1.4, 5, 0, 9.7, -0.2, 4, mat(0x444444));
        box(g, 0.9, 0.5, 0.04, 0.48, 10.1, -0.2, 4, mat(0xC0392B));
        [-1, 1].forEach(x => windowAt(g, x * 1.0, 4.7, 1.93, 0.6, 1.0, 0, 4));
        windowAt(g, 0, 3.0, 1.93, 0.8, 1.1, 0, 4);
        // banners on the walls
        [-3, 3].forEach(x => box(g, 0.7, 1.6, 0.05, x, 3.2, 5.45, 4, mat(0x1f4f9a)));
        // courtyard
        cyl(g, 0.5, 0.55, 0.9, 10, -2.8, 0.95, 2.4, 4, mat(0x8a8a8a, { map: 'stone', rx: 2, ry: 1 }));   // well
        pineTree(g, 3.0, 2.6, 1.0, 4);
    }

    // ── 8. Skyscraper ────────────────────────────────────────────────────
    function skyscraper(g) {
        base(g, 8.4, 8.4, 0.35, 0xa0a0a0);
        const glass = (w, h, d, x, y, z, rep) => box(g, w, h, d, x, y, z, 2, mat(0xffffff, { map: 'glass', rx: rep * Math.round(w), ry: Math.round(h / 1.2), rough: 0.15, metal: 0.6, emissive: 0x16324d, ei: 0.35 }));
        // podium + lobby
        box(g, 7.4, 1.9, 7.4, 0, 1.3, 0, 2, mat(0xd9d6cf, { map: 'plaster' }));
        box(g, 4.2, 1.5, 0.12, 0, 1.2, 3.75, 4, mat(0x7ec3f0, { rough: 0.05, metal: 0.8, emissive: 0x1d5f91, ei: 0.5 }));
        box(g, 5.2, 0.18, 1.6, 0, 2.15, 4.3, 4, mat(0x2b2b2e));
        [-2.4, 2.4].forEach(x => cyl(g, 0.12, 0.12, 1.9, 8, x, 1.3, 4.9, 4, mat(0xcccccc, { metal: 0.8 })));
        // tower stack with setbacks
        glass(5.6, 6.0, 5.6, 0, 5.25, 0, 1);
        glass(4.6, 3.6, 4.6, 0, 10.05, 0, 1);
        glass(3.4, 2.4, 3.4, 0, 13.05, 0, 1);
        [0, 3.0, 8.3, 11.9].forEach((y, i) => { const w = [5.9, 5.9, 4.9, 3.7][i]; box(g, w, 0.25, w, 0, 2.25 + y + (i > 0 ? 0.55 : 0), 0, 2, mat(0xcfcfcf, { metal: 0.5 })); });
        // roof details
        box(g, 3.8, 0.3, 3.8, 0, 14.4, 0, 3, mat(0x3a3a3f));
        cyl(g, 1.1, 1.1, 0.12, 20, 0, 14.65, 0, 4, mat(0x555555));
        box(g, 0.9, 0.04, 0.12, 0, 14.73, 0, 4, mat(0xffffff));
        box(g, 0.12, 0.04, 0.9, 0, 14.73, 0, 4, mat(0xffffff));
        cyl(g, 0.05, 0.12, 4.0, 8, 0, 16.6, 0, 4, mat(0xb8b8b8, { metal: 0.9 }));
        add(g, new T.SphereGeometry(0.14, 8, 8), mat(0xff3b30, { emissive: 0xff3b30, ei: 1.0 }), 0, 18.65, 0, 4);
        // plaza
        [[-3.4, 3.4], [3.4, 3.4], [-3.4, -3.4], [3.4, -3.4]].forEach(p => roundTree(g, p[0], p[1], 0.8, 4));
        lampPost(g, -3.6, 0, 4); lampPost(g, 3.6, 0, 4);
    }

    const BUILDERS = { hut: logCabin, cottage, townhouse, villa, mansion, chalet, castle, skyscraper };

    function createBuilding(type, group) {
        const fn = BUILDERS[type] || BUILDERS.cottage;
        fn(group);
        // The scale of the camera framing is handled by the scene via getTier(type).view
        return getTier(type);
    }

    // ── Characters ───────────────────────────────────────────────────────
    // Faces +Z. userData.parts holds pivots for animation.
    function createCharacter(o) {
        o = o || {};
        const skin = o.skin !== undefined ? o.skin : 0xF1C27D;
        const shirt = o.shirt !== undefined ? o.shirt : 0x2f6fbf;
        const pants = o.pants !== undefined ? o.pants : 0x35435a;
        const hat = o.hat !== undefined ? o.hat : 0xFFC21A;
        const hair = o.hair !== undefined ? o.hair : 0x4a2f1b;
        const vest = o.vest !== undefined ? o.vest : 0xFF7A1A;
        const female = !!o.female;
        const grp = new T.Group();
        const parts = {};
        const m = (c, r) => new T.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.75 : r, metalness: 0.02 });
        const put = (parent, geo, material, x, y, z) => {
            const mesh = new T.Mesh(geo, material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        };

        // legs (pivot at hip)
        [-1, 1].forEach(s => {
            const hip = new T.Group();
            hip.position.set(s * 0.17, 0.95, 0);
            grp.add(hip);
            put(hip, new T.CapsuleGeometry(0.12, 0.55, 4, 10), m(pants), 0, -0.42, 0);
            put(hip, new T.BoxGeometry(0.22, 0.16, 0.36), m(0x2b1d12, 0.6), 0, -0.86, 0.05);
            parts[s < 0 ? 'lLeg' : 'rLeg'] = hip;
        });
        // torso
        const torso = put(grp, new T.CapsuleGeometry(0.3, 0.45, 4, 12), m(shirt), 0, 1.35, 0);
        torso.scale.set(1, 1, 0.72);
        if (!female) torso.scale.set(1.08, 1, 0.74);
        const vestMesh = put(grp, new T.CapsuleGeometry(0.325, 0.4, 4, 12), m(vest, 0.6), 0, 1.35, 0);
        vestMesh.scale.set(torso.scale.x, 0.9, torso.scale.z + 0.05);
        [1.25, 1.45].forEach(y => put(grp, new T.BoxGeometry(0.72, 0.07, 0.36), m(0xE8F0A0, 0.3), 0, y, 0));
        put(grp, new T.BoxGeometry(0.66, 0.1, 0.42), m(0x5b3a24), 0, 1.0, 0);                  // belt
        put(grp, new T.BoxGeometry(0.12, 0.12, 0.08), m(0xD4AF37, 0.3), 0, 1.0, 0.22);         // buckle
        // arms (pivot at shoulder)
        [-1, 1].forEach(s => {
            const sh = new T.Group();
            sh.position.set(s * 0.43, 1.62, 0);
            grp.add(sh);
            put(sh, new T.CapsuleGeometry(0.095, 0.5, 4, 10), m(shirt), 0, -0.33, 0);
            put(sh, new T.SphereGeometry(0.1, 10, 8), m(skin), 0, -0.72, 0);
            put(sh, new T.SphereGeometry(0.13, 10, 8), m(vest, 0.6), 0, -0.02, 0);
            parts[s < 0 ? 'lArm' : 'rArm'] = sh;
            if (o.hammer && s > 0) {
                const hm = new T.Group();
                hm.position.set(0, -0.72, 0.05);
                sh.add(hm);
                put(hm, new T.CylinderGeometry(0.025, 0.025, 0.45, 6), m(0x6b4a2a), 0, 0, 0.1).rotation.x = Math.PI / 2;
                put(hm, new T.BoxGeometry(0.12, 0.12, 0.2), m(0x666a70, 0.4), 0, 0, 0.32);
            }
        });
        // neck + head
        put(grp, new T.CylinderGeometry(0.09, 0.1, 0.12, 8), m(skin), 0, 1.78, 0);
        const head = new T.Group();
        head.position.set(0, 2.0, 0);
        grp.add(head);
        const skull = put(head, new T.SphereGeometry(0.26, 20, 16), m(skin, 0.6), 0, 0, 0);
        skull.scale.set(1, 1.05, 0.96);
        [-1, 1].forEach(s => {
            put(head, new T.SphereGeometry(0.045, 8, 8), m(0xffffff, 0.3), s * 0.1, 0.03, 0.235);
            put(head, new T.SphereGeometry(0.026, 8, 8), m(0x1a1a1a, 0.2), s * 0.1, 0.03, 0.272);
            put(head, new T.BoxGeometry(0.09, 0.018, 0.02), m(shade(hair, 0.8)), s * 0.1, 0.1, 0.25);
            put(head, new T.SphereGeometry(0.04, 8, 8), m(skin), s * 0.26, -0.01, 0);
        });
        put(head, new T.SphereGeometry(0.04, 8, 8), m(shade(skin, 0.92)), 0, -0.03, 0.26);     // nose
        const mouth = put(head, new T.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), m(0x8b3a3a), 0, -0.1, 0.235);
        mouth.rotation.z = Math.PI;
        if (female) {
            put(head, new T.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m(hair), 0, 0.02, -0.03);
            const tail = put(head, new T.CapsuleGeometry(0.07, 0.34, 4, 8), m(hair), 0, -0.2, -0.3);
            tail.rotation.x = 0.35;
        } else {
            put(head, new T.SphereGeometry(0.275, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), m(hair), 0, 0.02, -0.03);
        }
        // hard hat
        put(head, new T.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), m(hat, 0.35), 0, 0.12, 0);
        put(head, new T.CylinderGeometry(0.36, 0.36, 0.035, 20), m(hat, 0.35), 0, 0.13, 0.04);
        put(head, new T.BoxGeometry(0.07, 0.05, 0.5), m(shade(hat, 0.85), 0.35), 0, 0.41, 0);
        parts.head = head;
        grp.userData.parts = parts;
        return grp;
    }

    function createWheelbarrow() {
        const w = new T.Group();
        const m = (c, me) => new T.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: me || 0.05 });
        const put = (geo, mt, x, y, z, rx) => { const mesh = new T.Mesh(geo, mt); mesh.position.set(x, y, z); if (rx) mesh.rotation.x = rx; mesh.castShadow = true; w.add(mesh); return mesh; };
        const tray = put(new T.BoxGeometry(0.9, 0.35, 1.1), m(0x2e7d32, 0.3), 0, 0.55, 0.3);
        tray.scale.set(1, 1, 1);
        put(new T.BoxGeometry(0.8, 0.08, 1.0), m(0x8b6b3a), 0, 0.74, 0.3);                       // load of bricks
        for (let i = 0; i < 4; i++) put(new T.BoxGeometry(0.34, 0.14, 0.2), m(0xB5533C), -0.2 + (i % 2) * 0.4, 0.84, 0.05 + Math.floor(i / 2) * 0.45);
        [-1, 1].forEach(s => put(new T.CylinderGeometry(0.03, 0.03, 1.4, 6), m(0x6b4a2a), s * 0.35, 0.6, -0.35, Math.PI / 2 - 0.12));
        const wheel = put(new T.CylinderGeometry(0.26, 0.26, 0.1, 16), m(0x222222), 0, 0.26, 0.82);
        wheel.rotation.z = Math.PI / 2;
        [-1, 1].forEach(s => put(new T.CylinderGeometry(0.03, 0.03, 0.5, 6), m(0x555555, 0.5), s * 0.4, 0.26, -0.15, 0));
        return w;
    }

    // Site props placed inside the fence: cones, crates, brick pallet, lumber, cement mixer
    function createSiteProps(parent, hw, hd) {
        hw = hw || 5; hd = hd || 5;
        const X = hw + 3.0, Z = hd + 3.0;
        const grp = new T.Group();
        const m = (c, r, me) => new T.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.8 : r, metalness: me || 0.03 });
        const put = (geo, mt, x, y, z, ry) => { const mesh = new T.Mesh(geo, mt); mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh); return mesh; };
        // traffic cones by the gate
        [[-1.6, Z], [1.6, Z], [-X, Z - 1], [X, -Z + 1]].forEach(p => {
            put(new T.ConeGeometry(0.28, 0.7, 12), m(0xFF6A13, 0.6), p[0], 0.35, p[1]);
            put(new T.CylinderGeometry(0.34, 0.34, 0.06, 12), m(0x222222), p[0], 0.03, p[1]);
            put(new T.CylinderGeometry(0.17, 0.2, 0.1, 12), m(0xffffff, 0.4), p[0], 0.38, p[1]);
        });
        // crate stack
        [[-X + 0.2, -Z + 1.2, 0.2], [-X + 1.1, -Z + 0.8, -0.3], [-X + 0.6, -Z + 1.1, 0.6]].forEach((p, i) => {
            put(new T.BoxGeometry(0.9, 0.9, 0.9), m(0xB07C45), p[0], 0.45 + (i === 2 ? 0.9 : 0), p[1], p[2]);
        });
        // brick pallet
        put(new T.BoxGeometry(1.6, 0.14, 1.1), m(0x8a6a3a), X - 0.6, 0.07, Z - 2.2);
        put(new T.BoxGeometry(1.4, 0.8, 0.9), m(0xB5533C, 0.9), X - 0.6, 0.55, Z - 2.2);
        // lumber pile
        for (let i = 0; i < 5; i++) put(new T.BoxGeometry(2.4, 0.14, 0.3), m(0xC9A36A), -X + 2.6, 0.1 + Math.floor(i / 3) * 0.16, Z - 0.9 - (i % 3) * 0.34);
        // cement mixer
        const mixer = new T.Group();
        mixer.position.set(-X + 0.8, 0, 0.5);
        grp.add(mixer);
        const drum = new T.Mesh(new T.CylinderGeometry(0.5, 0.35, 0.9, 14), m(0xF2B01E, 0.5, 0.3));
        drum.position.y = 0.95; drum.rotation.z = 0.5; drum.castShadow = true; mixer.add(drum);
        [-0.35, 0.35].forEach(x => { const leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.8, 6), m(0x444444, 0.5, 0.5)); leg.position.set(x, 0.4, 0); mixer.add(leg); });
        [-0.45, 0.45].forEach(x => { const wh = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.08, 12), m(0x1c1c1c)); wh.position.set(x, 0.2, 0.2); wh.rotation.z = Math.PI / 2; mixer.add(wh); });
        parent.add(grp);
        return grp;
    }

    window.BuildingFactory = {
        TIERS, tierFor, getTier, createBuilding, createCharacter, createWheelbarrow, createSiteProps,
        helpers: { mat, add, box, cyl, wall, gable, windowAt, doorAt, pineTree, snowPine, roundTree, palm, bush, lampPost, flowerBed, chimney, shade, makeTexture }
    };
    window.BuildingTiers = { TIERS, tierFor, getTier };
})();
