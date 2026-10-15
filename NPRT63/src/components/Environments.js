// Environments.js - surroundings for each building type plus the animated
// construction site (fence, scaffolding, crane, workers) that is shown while
// a focus session is running. Exposes window.EnvironmentFactory.
(function () {
    const T = window.THREE;
    const BF = () => window.BuildingFactory;
    const H = () => window.BuildingFactory.helpers;

    // ── shared helpers ───────────────────────────────────────────────────
    const rngFor = (seed) => {
        let a = seed >>> 0;
        return () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
    const lam = (c) => new T.MeshLambertMaterial({ color: c });
    const std = (c, r, m) => new T.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.85 : r, metalness: m || 0.02 });
    const put = (g, geo, mt, x, y, z, ry) => {
        const m = new T.Mesh(geo, mt);
        m.position.set(x, y, z);
        if (ry) m.rotation.y = ry;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        return m;
    };
    const B = (g, w, h, d, x, y, z, mt, ry) => put(g, new T.BoxGeometry(w, h, d), mt, x, y, z, ry);
    const C = (g, rt, rb, h, seg, x, y, z, mt) => put(g, new T.CylinderGeometry(rt, rb, h, seg), mt, x, y, z);

    // Subtle speckle so big flat grounds (grass, sand, snow) read as surfaces, not plain colour
    const noiseCache = {};
    function noiseTex(strength) {
        if (!noiseCache[strength]) {
            const S = 256, cv = document.createElement('canvas');
            cv.width = cv.height = S;
            const c = cv.getContext('2d');
            c.fillStyle = '#fff'; c.fillRect(0, 0, S, S);
            for (let i = 0; i < 5200; i++) {
                const v = Math.round(255 * (1 - Math.random() * strength));
                c.fillStyle = `rgb(${v},${v},${v})`;
                const w = 1 + Math.random() * 4;
                c.fillRect(Math.random() * S, Math.random() * S, w, w * (0.6 + Math.random()));
            }
            const t = new T.CanvasTexture(cv);
            t.wrapS = t.wrapT = T.RepeatWrapping;
            if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
            noiseCache[strength] = t;
        }
        return noiseCache[strength];
    }
    function disc(g, r, color, y, rough, speckle) {
        const m = new T.Mesh(new T.CircleGeometry(r, 64), std(color, rough === undefined ? 1 : rough));
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        m.receiveShadow = true;
        if (speckle) {
            const t = noiseTex(speckle).clone();
            t.needsUpdate = true;
            t.repeat.set(r / 5, r / 5);
            m.material.map = t;
        }
        g.add(m);
        return m;
    }
    function ring(g, ri, ro, color, y, opts) {
        const m = new T.Mesh(new T.RingGeometry(ri, ro, 64), std(color, 0.2, 0.1));
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        if (opts && opts.emissive) { m.material.emissive = new T.Color(opts.emissive); m.material.emissiveIntensity = 0.3; }
        g.add(m);
        return m;
    }
    function flatBox(g, w, d, x, z, color, y, ry, h) {
        return B(g, w, h || 0.06, d, x, y || 0.04, z, std(color, 0.95), ry);
    }

    // shared low-poly trees (Lambert = cheap for large counts)
    const treeMats = { trunk: lam(0x6b4226), pine: lam(0x2d7a3a), pine2: lam(0x1f6b34), leaf: lam(0x4aa24f), leaf2: lam(0x3a8f45), autumn: lam(0xd9822b) };
    const treeGeo = { trunk: new T.CylinderGeometry(0.14, 0.2, 1.2, 6), cone: new T.ConeGeometry(1, 1.2, 7), blob: new T.IcosahedronGeometry(0.95, 0) };
    function tree(g, x, z, s, kind) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        const t = new T.Mesh(treeGeo.trunk, treeMats.trunk); t.position.y = 0.6 * s; t.scale.set(s, s, s); t.castShadow = true; grp.add(t);
        if (kind === 'pine') {
            [0, 1, 2].forEach(i => {
                const c = new T.Mesh(treeGeo.cone, i % 2 ? treeMats.pine2 : treeMats.pine);
                c.position.y = (1.3 + i * 0.8) * s; c.scale.set((1.0 - i * 0.2) * s, s, (1.0 - i * 0.2) * s); c.castShadow = true; grp.add(c);
            });
        } else {
            const b = new T.Mesh(treeGeo.blob, kind === 'autumn' ? treeMats.autumn : (x % 2 > 1 ? treeMats.leaf : treeMats.leaf2));
            b.position.y = 1.9 * s; b.scale.set(1.1 * s, 1.0 * s, 1.1 * s); b.castShadow = true; grp.add(b);
        }
        g.add(grp);
        return grp;
    }
    function rock(g, x, z, s, color) {
        const r = new T.Mesh(new T.DodecahedronGeometry(s, 0), lam(color || 0x8a8a86));
        r.position.set(x, s * 0.4, z);
        r.scale.y = 0.65; r.rotation.set(x, z, 0);
        r.castShadow = true;
        g.add(r);
    }
    function cloud(g, x, y, z, s) {
        const grp = new T.Group();
        grp.position.set(x * 2.2, y + 10, z * 2.2);
        s = s * 1.1;
        [[0, 0, 0, 1.6], [1.4, -0.2, 0.2, 1.2], [-1.4, -0.2, 0, 1.2], [0.6, 0.4, -0.3, 1.0]].forEach(p => {
            const m = new T.Mesh(new T.SphereGeometry(p[3] * s, 10, 8), new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
            m.position.set(p[0] * s, p[1] * s, p[2] * s);
            grp.add(m);
        });
        g.add(grp);
        return grp;
    }
    function car(g, x, z, ry, color) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        grp.rotation.y = ry || 0;
        B(grp, 2.0, 0.5, 0.95, 0, 0.45, 0, std(color, 0.35, 0.5));
        B(grp, 1.0, 0.4, 0.85, -0.1, 0.9, 0, std(0x9fd6f5, 0.1, 0.6));
        B(grp, 0.12, 0.12, 0.2, 1.0, 0.45, 0.32, std(0xfff2b0, 0.2, 0.2));
        B(grp, 0.12, 0.12, 0.2, 1.0, 0.45, -0.32, std(0xfff2b0, 0.2, 0.2));
        [[0.65, 0.5], [-0.65, 0.5], [0.65, -0.5], [-0.65, -0.5]].forEach(p => {
            const w = C(grp, 0.22, 0.22, 0.18, 12, p[0], 0.22, p[1], lam(0x1a1a1a));
            w.rotation.x = Math.PI / 2;
        });
        g.add(grp);
        return grp;
    }
    function streetLamp(g, x, z, ry) {
        C(g, 0.05, 0.07, 3.0, 6, x, 1.5, z, std(0x2b2b2b, 0.5, 0.6));
        const arm = B(g, 0.8, 0.06, 0.06, x + 0.35, 3.0, z, std(0x2b2b2b, 0.5, 0.6));
        put(g, new T.SphereGeometry(0.16, 8, 6), std(0xFFF2B0, 0.3), x + 0.7, 2.95, z).material.emissive = new T.Color(0xffd966);
    }
    function road(g, x, z, len, wid, ry, lines) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        B(grp, len, 0.05, wid, 0, 0.035, 0, std(0x34373c, 0.95));
        if (lines !== false) for (let i = 0; i < len / 2.4; i++) B(grp, 1.1, 0.01, 0.12, -len / 2 + 1.2 + i * 2.4, 0.07, 0, std(0xf4f0d0, 0.9));
        [-1, 1].forEach(s => B(grp, len, 0.16, 1.2, 0, 0.1, s * (wid / 2 + 0.6), std(0xc9c9c4, 0.9)));
        return grp;
    }
    function crosswalk(g, x, z, ry) {
        const grp = new T.Group();
        grp.position.set(x, 0.08, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        for (let i = 0; i < 7; i++) B(grp, 0.5, 0.01, 2.6, -1.8 + i * 0.6, 0, 0, std(0xffffff, 0.9));
    }
    function trafficLight(g, x, z) {
        C(g, 0.06, 0.08, 3.4, 6, x, 1.7, z, std(0x2b2b2b, 0.5, 0.6));
        B(g, 0.3, 0.9, 0.3, x, 3.4, z, std(0x1a1a1a));
        [[0xff3b30, 3.65], [0xffc107, 3.4], [0x34c759, 3.15]].forEach(p => put(g, new T.SphereGeometry(0.09, 8, 6), std(p[0], 0.3), x, p[1], z + 0.15).material.emissive = new T.Color(p[0]));
    }
    // simple tower used as skyline / neighbours
    function tower(g, x, z, w, h, d, kind, color) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        g.add(grp);
        const h0 = H();
        const mat = (rx, ry) => h0.mat(color || 0xffffff, { map: kind, rx: rx, ry: ry, rough: kind === 'glass' ? 0.2 : 0.9, metal: kind === 'glass' ? 0.5 : 0.02 });
        B(grp, w, h, d, 0, h / 2, 0, mat(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 1.4))));
        B(grp, w + 0.3, 0.3, d + 0.3, 0, h + 0.15, 0, std(0x4a4a4f));
        if (h > 8) {                                                       // stepped crown
            B(grp, w * 0.72, h * 0.22, d * 0.72, 0, h + 0.3 + h * 0.11, 0, mat(Math.max(1, Math.round(w * 0.7)), 2));
            B(grp, w * 0.72 + 0.3, 0.25, d * 0.72 + 0.3, 0, h + 0.3 + h * 0.22 + 0.12, 0, std(0x4a4a4f));
        }
        if (h > 6) { B(grp, w * 0.4, 0.8, d * 0.4, 0, h + 0.7 + (h > 8 ? h * 0.22 : 0), 0, std(0x777c82)); }
        if (h > 9) { C(grp, 0.03, 0.05, 1.8, 5, w * 0.2, h + 1.2 + h * 0.22, d * 0.2, std(0xaaaaaa, 0.4, 0.8)); }
        return grp;
    }
    function rowHouse(g, x, z, ry, color, roofColor, kind) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        const h0 = H();
        B(grp, 4.4, 5.4, 4.2, 0, 2.7, 0, h0.mat(color, { map: kind || 'brick', rx: 2, ry: 3 }));
        const roof = h0.gable(grp, 4.4, 1.8, 4.2, 0.4, 0, 5.4, 0, roofColor, 0, Math.PI / 2);
        [-1.2, 1.2].forEach(dx => { h0.windowAt(grp, dx, 3.8, 2.12, 0.9, 1.1, 0, 0); h0.windowAt(grp, dx, 1.8, 2.12, 0.9, 1.1, 0, 0); });
        h0.doorAt(grp, 0, 0, 2.12, 0.9, 1.7, 0x2e4a6b, 0, 0);
        return grp;
    }
    function tent(g, x, z, ry, color) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        const geo = new T.ConeGeometry(1.5, 1.8, 4);
        geo.rotateY(Math.PI / 4);
        put(grp, geo, std(color, 0.9), 0, 0.9, 0);
        B(grp, 0.6, 1.0, 0.05, 0, 0.5, 1.05, std(0x2b1d12));
    }
    function marketStall(g, x, z, ry, color) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]].forEach(p => C(grp, 0.05, 0.05, 2.0, 5, p[0], 1.0, p[1], std(0x6b4a2a)));
        for (let i = 0; i < 6; i++) B(grp, 0.32, 0.06, 1.5, -0.8 + i * 0.32, 2.05 - i * 0.0, 0, std(i % 2 ? 0xffffff : color), 0).rotation.x = 0.12;
        B(grp, 1.9, 0.12, 1.0, 0, 0.85, 0.1, std(0x8a5a30));
        [0xc0392b, 0xf1c40f, 0x27ae60].forEach((c, i) => put(grp, new T.SphereGeometry(0.14, 8, 6), std(c), -0.6 + i * 0.6, 1.0, 0.1));
    }
    function hay(g, x, z, s) {
        const m = C(g, 0.55 * s, 0.55 * s, 0.9 * s, 14, x, 0.45 * s, z, std(0xe3c35a, 1));
        m.rotation.z = Math.PI / 2; m.rotation.y = x;
    }
    function sheep(g, x, z, ry) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        put(grp, new T.SphereGeometry(0.4, 10, 8), std(0xf6f2e9, 1), 0, 0.55, 0).scale.set(1.3, 0.9, 0.9);
        put(grp, new T.SphereGeometry(0.2, 8, 6), std(0x2a2a2a), 0.55, 0.65, 0);
        [[-0.25, 0.18], [0.25, 0.18], [-0.25, -0.18], [0.25, -0.18]].forEach(p => C(grp, 0.04, 0.04, 0.3, 5, p[0], 0.15, p[1], std(0x2a2a2a)));
    }
    function umbrella(g, x, z, color) {
        C(g, 0.03, 0.03, 2.0, 5, x, 1.0, z, std(0xdddddd));
        put(g, new T.ConeGeometry(1.1, 0.5, 10), std(color, 0.8), x, 2.1, z);
    }
    function lounger(g, x, z, ry) {
        B(g, 0.6, 0.1, 1.5, x, 0.28, z, std(0xffffff), ry);
        B(g, 0.6, 0.1, 0.6, x + Math.sin(ry || 0) * 0.7, 0.55, z + Math.cos(ry || 0) * 0.7, std(0xffffff), ry).rotation.x = -0.6;
    }
    function boat(g, x, z, ry, color) {
        const grp = new T.Group();
        grp.position.set(x, 0.1, z);
        grp.rotation.y = ry || 0;
        g.add(grp);
        const hull = put(grp, new T.BoxGeometry(2.6, 0.5, 1.0), std(color, 0.4), 0, 0.2, 0);
        put(grp, new T.ConeGeometry(0.5, 0.9, 4), std(color, 0.4), 1.6, 0.2, 0).rotation.z = -Math.PI / 2;
        B(grp, 0.9, 0.5, 0.7, -0.3, 0.7, 0, std(0xffffff));
        C(grp, 0.04, 0.04, 2.2, 5, 0.3, 1.5, 0, std(0x666666));
        B(grp, 0.05, 1.6, 1.0, 0.3, 1.5, 0.5, std(0xffffff));
    }
    function wavesAnim(rings, t) {
        rings.forEach((r, i) => {
            const k = (t * 0.25 + i / rings.length) % 1;
            r.scale.setScalar(0.6 + k * 0.7);
            r.material.opacity = 0.35 * (1 - k);
        });
    }
    function mountains(g, count, radius, rand, color, snow) {
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + rand() * 0.3;
            const h = 6 + rand() * 6, r = 4 + rand() * 3;
            const m = new T.Mesh(new T.ConeGeometry(r, h, 6), lam(color));
            m.position.set(Math.cos(a) * radius, h / 2, Math.sin(a) * radius);
            g.add(m);
            if (snow) { const c = new T.Mesh(new T.ConeGeometry(r * 0.38, h * 0.3, 6), lam(0xf4f8fb)); c.position.set(m.position.x, h * 0.86, m.position.z); g.add(c); }
        }
    }

    // ── Environments ─────────────────────────────────────────────────────
    const ENV = {};

    // 1. Forest clearing around the log cabin
    ENV.hut = (g, rand, anim) => {
        disc(g, 30, 0x3f7a3f, 0.01, 1, 0.14);
        disc(g, 8.5, 0x7a6a45, 0.02);                                       // clearing
        flatBox(g, 1.4, 9, 0, 9.5, 0x8a7550, 0.035);                            // dirt trail
        for (let i = 0; i < 70; i++) {
            const a = rand() * Math.PI * 2, r = 9.5 + rand() * 16;
            tree(g, Math.cos(a) * r, Math.sin(a) * r, 0.75 + rand() * 0.75, 'pine');
        }
        // pond
        disc(g, 3.2, 0x3b8fc4, 0.045, 0.1).position.set(-8.5, 0.045, -4);
        for (let i = 0; i < 7; i++) rock(g, -8.5 + Math.cos(i) * 3.4, -4 + Math.sin(i) * 3.4, 0.35 + rand() * 0.3);
        // campfire with log seats and a tent
        const fx = 6.5, fz = 5.5;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; rock(g, fx + Math.cos(a) * 0.7, fz + Math.sin(a) * 0.7, 0.18, 0x666660); }
        const flame = put(g, new T.ConeGeometry(0.35, 0.9, 7), std(0xff8a1f, 0.4), fx, 0.55, fz);
        flame.material.emissive = new T.Color(0xff5500); flame.material.emissiveIntensity = 1.2;
        const flame2 = put(g, new T.ConeGeometry(0.2, 0.6, 6), std(0xffd166, 0.4), fx, 0.5, fz);
        flame2.material.emissive = new T.Color(0xffaa00); flame2.material.emissiveIntensity = 1.4;
        [0.6, 2.4, 4.2].forEach(a => C(g, 0.18, 0.18, 1.3, 8, fx + Math.cos(a) * 1.7, 0.2, fz + Math.sin(a) * 1.7, std(0x7a4f2b)).rotation.z = Math.PI / 2);
        tent(g, 9.2, 3.4, -0.6, 0xd9822b);
        anim.push((t) => { flame.scale.y = 1 + Math.sin(t * 9) * 0.15; flame2.scale.y = 1 + Math.sin(t * 13 + 1) * 0.2; });
        mountains(g, 10, 36, rand, 0x56706a, true);
    };

    // 2. Countryside farm around the cottage
    ENV.cottage = (g, rand, anim) => {
        disc(g, 30, 0x78c25a, 0.01, 1, 0.16);
        flatBox(g, 1.8, 16, 0, 12, 0xb79a6a, 0.04);                             // lane
        // crop fields
        [[-13, -3, 0xe8c547], [-13, 6, 0x86b84a], [13, -5, 0x86b84a]].forEach(f => {
            flatBox(g, 9, 7, f[0], f[1], 0x6b4a2a, 0.04);
            for (let i = 0; i < 8; i++) B(g, 8.4, 0.35, 0.5, f[0], 0.22, f[1] - 3 + i * 0.85, std(f[2], 1));
        });
        // rolling hills + trees
        for (let i = 0; i < 5; i++) { const a = rand() * 6.28, r = 24 + rand() * 4; const hill = new T.Mesh(new T.SphereGeometry(5 + rand() * 3, 14, 10), lam(0x66b04e)); hill.position.set(Math.cos(a) * r, -1.5, Math.sin(a) * r); hill.scale.y = 0.5; g.add(hill); }
        for (let i = 0; i < 26; i++) { const a = rand() * 6.28, r = 11 + rand() * 12; tree(g, Math.cos(a) * r, Math.sin(a) * r, 0.9 + rand() * 0.7, rand() > 0.8 ? 'autumn' : 'round'); }
        // hay, sheep, flowers
        [[6.5, -5.5], [7.7, -5.1], [7.0, -6.6]].forEach(p => hay(g, p[0], p[1], 1.1));
        [[8, 7], [10, 8.5], [9, 5.5], [11, 6.3]].forEach((p, i) => sheep(g, p[0], p[1], i));
        for (let i = 0; i < 40; i++) { const a = rand() * 6.28, r = 6 + rand() * 7; put(g, new T.SphereGeometry(0.1, 6, 6), lam([0xff6b9d, 0xffd166, 0xffffff, 0xda70d6][i % 4]), Math.cos(a) * r, 0.12, Math.sin(a) * r); }
        // windmill with spinning blades
        const wm = new T.Group(); wm.position.set(-12, 0, -13); g.add(wm);
        put(wm, new T.CylinderGeometry(1.1, 1.8, 5.5, 8), std(0xe9dcc6), 0, 2.75, 0);
        put(wm, new T.ConeGeometry(1.6, 1.6, 8), std(0x9a3b2e), 0, 6.3, 0);
        const blades = new T.Group(); blades.position.set(0, 5.0, 1.4); wm.add(blades);
        for (let i = 0; i < 4; i++) { const bl = B(blades, 0.5, 3.4, 0.08, 0, 0, 0, std(0xf4efe3)); bl.position.y = 1.7; const pivot = new T.Group(); pivot.rotation.z = i * Math.PI / 2; pivot.add(bl); blades.add(pivot); }
        anim.push((t) => { blades.rotation.z = t * 0.6; });
        // red barn
        const barn = new T.Group(); barn.position.set(13, 0, 9); barn.rotation.y = -0.6; g.add(barn);
        B(barn, 4, 3, 5, 0, 1.5, 0, std(0xb23a2e)); H().gable(barn, 4, 1.8, 5, 0.3, 0, 3, 0, 0x555a60, 0, 0);
        B(barn, 1.6, 2.2, 0.1, 0, 1.1, 2.55, std(0xfff5e6));
        cloud(g, -8, 17, -14, 1.4); cloud(g, 12, 19, -10, 1.8);
    };

    // 3. Suburban/urban street around the townhouse
    ENV.townhouse = (g, rand, anim) => {
        disc(g, 30, 0x5c9b4d, 0.01, 1, 0.16);
        disc(g, 30, 0x808389, 0.015, 0.95);
        // main street in front (+Z) and side street
        road(g, 0, 12, 60, 5.2, 0, true);
        road(g, -14, -4, 40, 5.2, Math.PI / 2, true);
        crosswalk(g, 6, 12, Math.PI / 2); crosswalk(g, -14, 12, Math.PI / 2);
        // neighbouring terraces
        const cols = [0xc2634a, 0xd8b36a, 0x8f6a56, 0xa7b4c2];
        [-9.5, -14.5].forEach((x, i) => rowHouse(g, x, 1, 0, cols[i], 0x4a4a55));
        [11, 15.5].forEach((x, i) => rowHouse(g, x, 1.5, 0, cols[i + 2], 0x5a3b2e));
        [-8, 0, 9, 17].forEach((x, i) => rowHouse(g, x + (i % 2) * 0.5, -10, Math.PI, cols[(i + 1) % 4], 0x4a4a55));
        // street furniture
        [-12, -2, 8, 16].forEach(x => streetLamp(g, x, 9.0, 0));
        trafficLight(g, 8.5, 9.0);
        for (let i = 0; i < 6; i++) tree(g, -17 + i * 6.5, 9.2, 0.7, 'round');
        const cars = [car(g, 6, 11, Math.PI, 0xc0392b), car(g, -4, 13.2, 0, 0x2e86c1)];
        car(g, -16, 8.2, 0, 0xf1c40f).rotation.y = Math.PI / 2;
        anim.push((t) => { cars[0].position.x = ((t * 2.2 + 30) % 60) - 30 + 0; cars[0].position.x *= -1; cars[1].position.x = ((t * 1.8) % 60) - 30; });
        // hydrant, mailbox, bench
        C(g, 0.16, 0.2, 0.7, 8, 3.8, 0.35, 8.9, std(0xd63031, 0.5));
        B(g, 0.4, 0.5, 0.3, -3.5, 0.6, 8.9, std(0x2e5fa8, 0.5)); B(g, 1.4, 0.1, 0.5, 4.5, 0.45, 8.9, std(0x8a5a30));
        // skyline at the back
        [[-18, -20, 5, 14, 5], [-10, -22, 6, 18, 6], [0, -24, 7, 22, 6], [10, -21, 5, 16, 5], [18, -23, 6, 20, 6]].forEach(t => tower(g, t[0], t[1], t[2], t[3], t[4], 'glass', 0xffffff));
        cloud(g, -6, 20, -18, 1.6); cloud(g, 14, 24, -12, 1.4);
    };

    // 4. Tropical beach resort around the villa
    ENV.villa = (g, rand, anim) => {
        disc(g, 30, 0xe9d9a8, 0.01, 1, 0.14);
        disc(g, 12, 0x5aae56, 0.02, 1, 0.16);                                              // garden lawn
        const sea = new T.Mesh(new T.PlaneGeometry(70, 26), std(0x2aa6d6, 0.1, 0.3)); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.03, -29); g.add(sea);
        const surf = new T.Mesh(new T.PlaneGeometry(70, 1.0), std(0xffffff, 0.3)); surf.rotation.x = -Math.PI / 2; surf.position.set(0, 0.045, -16.3); g.add(surf);
        // palms, umbrellas, loungers
        for (let i = 0; i < 12; i++) { const a = -2.8 + (i / 11) * 2.5 + Math.PI; H().palm(g, Math.cos(a) * (14 + rand() * 6), Math.sin(a) * (14 + rand() * 6) * 0.9, 1.1 + rand() * 0.5, 0); }
        for (let i = 0; i < 6; i++) { const x = -12 + i * 4.8; umbrella(g, x, -11, [0xe74c3c, 0xf1c40f, 0x3498db][i % 3]); lounger(g, x + 0.9, -11.6, 0.3); }
        // jetty + yacht + sailboat
        B(g, 1.6, 0.2, 9, 8, 0.35, -17, std(0x8a5a30)); [-3, -1, 1, 3].forEach(z => { C(g, 0.1, 0.1, 0.9, 6, 7.3, 0.15, -17 + z, std(0x5b3a24)); C(g, 0.1, 0.1, 0.9, 6, 8.7, 0.15, -17 + z, std(0x5b3a24)); });
        const yacht = new T.Group(); g.add(yacht); boat(yacht, 0, 0, 0, 0xffffff); yacht.position.set(12, 0, -22);
        const sail = new T.Group(); g.add(sail); boat(sail, 0, 0, 0, 0xe74c3c); sail.position.set(-14, 0, -24);
        anim.push((t) => { yacht.position.y = Math.sin(t * 1.2) * 0.08; sail.position.y = Math.sin(t * 1.0 + 1) * 0.1; sail.rotation.z = Math.sin(t * 0.8) * 0.03; });
        // palm-lined path + sun lamps
        flatBox(g, 1.6, 8, 0, 8.5, 0xcdb98a, 0.04);
        for (let i = 0; i < 6; i++) rock(g, -12 + rand() * 24, 12 + rand() * 6, 0.25 + rand() * 0.2, 0xbdb7a5);
        cloud(g, -10, 18, -20, 1.6); cloud(g, 10, 20, -26, 1.9);
    };

    // 5. Formal estate with gates, hedges and long driveway around the mansion
    ENV.mansion = (g, rand, anim) => {
        disc(g, 30, 0x4ea04f, 0.01, 1, 0.16);
        for (let i = 0; i < 12; i++) flatBox(g, 60, 1.2, 0, -26 + i * 4.6, i % 2 ? 0x4aa04a : 0x56ab56, 0.015);      // mown stripes
        // driveway loop
        flatBox(g, 3.4, 16, 0, 14, 0xcbbf9c, 0.04);
        ring(g, 5.2, 8.3, 0xcbbf9c, 0.04);
        disc(g, 3.6, 0x4ea04f, 0.05); disc(g, 0.7, 0xd9d0bb, 0.06);
        // hedge perimeter + gate
        const hedge = std(0x24632f, 1);
        [-1, 1].forEach(s => { B(g, 13, 1.6, 1.0, s * 10.5, 0.8, 19.5, hedge); });
        B(g, 40, 1.8, 1.0, 0, 0.9, -21, hedge); B(g, 1.0, 1.8, 40, -20.5, 0.9, 0, hedge); B(g, 1.0, 1.8, 40, 20.5, 0.9, 0, hedge);
        [-2.4, 2.4].forEach(x => { B(g, 0.9, 3.2, 0.9, x, 1.6, 19.5, std(0xd8d0bb, 0.7)); put(g, new T.SphereGeometry(0.4, 10, 8), std(0xd8d0bb, 0.6), x, 3.4, 19.5); });
        [-1, 1].forEach(s => { for (let i = 0; i < 7; i++) C(g, 0.04, 0.04, 2.4, 5, s * (0.5 + i * 0.28) + (s < 0 ? -0.3 : 0.3) * 0, 1.2, 19.5, std(0x1a1a1a, 0.4, 0.7)); });
        // tree avenue + topiary + garden beds
        for (let i = 0; i < 7; i++) [-3, 3].forEach(s => tree(g, s * 2.4 + (s < 0 ? -1.2 : 1.2), 8 + i * 1.8, 0.9, 'round'));
        for (let i = 0; i < 4; i++) [-1, 1].forEach(s => { C(g, 0.16, 0.2, 0.5, 6, s * 7, 0.25, 6.5 + i * 3.4, std(0xb9b1a1)); put(g, new T.SphereGeometry(0.55, 12, 10), lam(0x2f7d3a), s * 7, 1.0, 6.5 + i * 3.4); });
        for (let i = 0; i < 6; i++) { const a = rand() * 6.28, r = 14 + rand() * 4; tree(g, Math.cos(a) * r, -Math.abs(Math.sin(a)) * r, 1.2 + rand() * 0.6, 'round'); }
        H().flowerBed(g, -7, 4.2, 4.5, 0); H().flowerBed(g, 7, 4.2, 4.5, 0);
        const cars = [car(g, -2.2, 13, Math.PI / 2, 0x1a1a1a), car(g, 2.2, 15.5, -Math.PI / 2, 0xb3b3b8)];
        cloud(g, -8, 18, -16, 1.8); cloud(g, 12, 21, -18, 1.5);
    };

    // 6. Snowy alpine valley around the chalet
    const snowMats = { pine: lam(0x24683a), pine2: lam(0x1c5a31), cap: lam(0xf6f9fc), snow: lam(0xf4f8fb), trunk: lam(0x5b3d26) };
    const snowGeo = { cone: new T.ConeGeometry(1, 1.1, 8), capCone: new T.ConeGeometry(0.8, 0.6, 8), trunk: new T.CylinderGeometry(0.14, 0.2, 1.2, 6) };
    function snowTree(g, x, z, s) {
        const grp = new T.Group();
        grp.position.set(x, 0, z);
        const t = new T.Mesh(snowGeo.trunk, snowMats.trunk); t.position.y = 0.6 * s; t.scale.set(s, s, s); t.castShadow = true; grp.add(t);
        for (let i = 0; i < 4; i++) {
            const k = 1.1 - i * 0.22, y = (1.2 + i * 0.75) * s;
            const c = new T.Mesh(snowGeo.cone, i % 2 ? snowMats.pine2 : snowMats.pine);
            c.position.y = y; c.scale.set(k * s, s, k * s); c.castShadow = true; grp.add(c);
            const cap = new T.Mesh(snowGeo.capCone, snowMats.cap);
            cap.position.y = y + 0.22 * s; cap.scale.set(k * s, s * 0.85, k * s); grp.add(cap);
        }
        g.add(grp);
        return grp;
    }
    function snowman(g, x, z, ry) {
        const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry || 0; g.add(grp);
        [[0.75, 0.75], [0.56, 1.75], [0.4, 2.55]].forEach(p => { const m = put(grp, new T.SphereGeometry(p[0], 14, 10), snowMats.snow, 0, p[1], 0); });
        put(grp, new T.ConeGeometry(0.07, 0.45, 6), std(0xff7a1a, 0.6), 0, 2.55, 0.46).rotation.x = Math.PI / 2;
        [-0.14, 0.14].forEach(dx => put(grp, new T.SphereGeometry(0.05, 6, 6), std(0x1a1a1a, 0.5), dx, 2.65, 0.36));
        [0, 0.28, 0.56].forEach((dy, i) => put(grp, new T.SphereGeometry(0.06, 6, 6), std(0x1a1a1a, 0.5), 0, 1.95 - dy * 0.9 + (i ? 0 : 0.1), 0.52 - i * 0.04));
        const scarf = put(grp, new T.TorusGeometry(0.42, 0.09, 8, 16), std(0xc0392b, 0.8), 0, 2.2, 0); scarf.rotation.x = Math.PI / 2;
        put(grp, new T.CylinderGeometry(0.3, 0.3, 0.5, 12), std(0x2a2a2a, 0.7), 0, 3.1, 0);
        put(grp, new T.CylinderGeometry(0.42, 0.42, 0.06, 12), std(0x2a2a2a, 0.7), 0, 2.86, 0);
    }
    function sled(g, x, z, ry) {
        const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry || 0; g.add(grp);
        B(grp, 1.7, 0.1, 0.7, 0, 0.32, 0, std(0x9a6a3a, 0.9));
        [-0.28, 0.28].forEach(dz => { B(grp, 1.9, 0.06, 0.07, 0, 0.12, dz, std(0x555a60, 0.4, 0.7)); [-0.6, 0.6].forEach(dx => B(grp, 0.06, 0.22, 0.06, dx, 0.22, dz, std(0x555a60, 0.4, 0.7))); });
        [-0.5, 0, 0.5].forEach(dx => B(grp, 0.08, 0.04, 0.7, dx, 0.39, 0, std(0xb98a55, 0.9)));
    }
    ENV.chalet = (g, rand, anim) => {
        disc(g, 30, 0xe8f0f7, 0.01, 0.95, 0.07);                                      // snow field
        disc(g, 11, 0xffffff, 0.015, 0.95);                                     // untouched yard
        // frozen pond with a rim of rocks
        const pond = disc(g, 4.2, 0xa8d4ea, 0.03, 0.08); pond.position.set(-11, 0.03, 7); pond.material.metalness = 0.25;
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; rock(g, -11 + Math.cos(a) * 4.5, 7 + Math.sin(a) * 4.5, 0.4 + rand() * 0.3, 0x8a8f94); }
        // trodden path from the door
        flatBox(g, 1.9, 12, 0, 9.5, 0xd6e2ec, 0.04);
        for (let i = 0; i < 6; i++) B(g, 0.9, 0.03, 0.25, (rand() - 0.5) * 1.2, 0.07, 5 + i * 1.9, std(0xc2d3e0, 1));
        // forest of snowy pines around the valley
        for (let i = 0; i < 70; i++) {
            const a = rand() * 6.28, r = 12 + rand() * 17;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            if (Math.abs(x) < 2.6 && z > 0) continue;
            if (Math.hypot(x + 11, z - 7) < 6.5) continue;
            snowTree(g, x, z, 0.7 + rand() * 0.75);
        }
        // small drifts
        for (let i = 0; i < 18; i++) {
            const a = rand() * 6.28, r = 8 + rand() * 18;
            const d = put(g, new T.SphereGeometry(0.8 + rand() * 1.1, 10, 6), snowMats.snow, Math.cos(a) * r, 0, Math.sin(a) * r);
            d.scale.y = 0.35; d.castShadow = false;
        }
        // picket fence along the yard
        for (let i = 0; i < 9; i++) { const x = 6 + i * 1.2; B(g, 0.14, 1.0, 0.14, x, 0.5, 10, std(0x8a6a45)); B(g, 0.2, 0.08, 0.2, x, 1.03, 10, std(0xf6f9fc, 1)); }
        B(g, 10.4, 0.1, 0.07, 10.8, 0.85, 10, std(0x8a6a45)); B(g, 10.4, 0.1, 0.07, 10.8, 0.5, 10, std(0x8a6a45));
        snowman(g, 7.5, 6.2, -0.5);
        sled(g, -5.5, 8.2, 0.4);
        mountains(g, 12, 41, rand, 0x7a8da0, true);
        // gentle snowfall
        const N = 520, pos = new Float32Array(N * 3), base = [];
        for (let i = 0; i < N; i++) { base.push({ x: (rand() - 0.5) * 70, y: rand() * 26, z: (rand() - 0.5) * 70, s: 0.9 + rand() * 1.1, p: rand() * 6.28 }); }
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
        const flakes = new T.Points(geo, new T.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
        flakes.frustumCulled = false; g.add(flakes);
        anim.push((t) => {
            for (let i = 0; i < N; i++) {
                const b = base[i];
                pos[i * 3] = b.x + Math.sin(t * 0.6 + b.p) * 0.9;
                pos[i * 3 + 1] = (((b.y - t * b.s) % 26) + 26) % 26;
                pos[i * 3 + 2] = b.z + Math.cos(t * 0.5 + b.p) * 0.9;
            }
            geo.attributes.position.needsUpdate = true;
        });
        cloud(g, -12, 20, -18, 1.8); cloud(g, 10, 23, -24, 2.1);
    };

    // 7. Medieval kingdom: moat, market, tents, guards and forest around the castle
    ENV.castle = (g, rand, anim) => {
        disc(g, 30, 0x5fa24e, 0.01, 1, 0.18);
        const moat = ring(g, 6.7, 9.0, 0x2e86b8, 0.045); moat.material.roughness = 0.1;
        ring(g, 6.5, 6.7, 0x8e8e88, 0.05); ring(g, 9.0, 9.25, 0x8e8e88, 0.05);
        flatBox(g, 3.4, 12, 0, 15.5, 0xb59a6a, 0.04);                                   // road to the gate
        // market with stalls and tents
        [[-6, 13, 0xc0392b], [-9, 15, 0x2874a6], [6.5, 13.5, 0xd4ac0d], [9.5, 15, 0x1e8449]].forEach(s => marketStall(g, s[0], s[1], 0.2, s[2]));
        [[-13, 4, 0xc0392b], [13, 5, 0x2874a6], [-14, -4, 0xd4ac0d], [14, -3, 0x1e8449]].forEach((s, i) => tent(g, s[0], s[1], i, s[2]));
        for (let i = 0; i < 10; i++) { const x = -5 + i * 1.1; B(g, 0.25, 0.9, 0.25, x, 0.45, 20.5, std(0x6b4a2a)); }
        // forest + hills + mountains
        for (let i = 0; i < 45; i++) { const a = rand() * 6.28, r = 16 + rand() * 12; if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.3) continue; tree(g, Math.cos(a) * r, Math.sin(a) * r, 0.9 + rand() * 0.8, rand() > 0.5 ? 'pine' : 'round'); }
        mountains(g, 12, 38, rand, 0x6a7a8c, true);
        [[-5, 2], [5, 2]].forEach(() => 0);
        // guards at the gate and a banner pole
        const F = BF();
        [-3.2, 3.2].forEach((x, i) => { const gd = F.createCharacter({ shirt: 0x9aa3ad, pants: 0x556070, hat: 0xb8c0c8, vest: 0x2e5fa8, skin: 0xe0b080, hair: 0x3a2a1a }); gd.position.set(x, 0.0, 9.5); gd.rotation.y = 0; gd.userData.parts.rArm.rotation.x = -0.4; g.add(gd); const spear = C(g, 0.03, 0.03, 3.0, 5, x + 0.5, 1.5, 9.8, std(0x6b4a2a)); put(g, new T.ConeGeometry(0.1, 0.4, 5), std(0xc0c8d0, 0.3, 0.8), x + 0.5, 3.2, 9.8); });
        // knights' training dummies
        [[-8, 6], [8, 7]].forEach(p => { C(g, 0.06, 0.06, 1.6, 5, p[0], 0.8, p[1], std(0x6b4a2a)); B(g, 0.9, 0.12, 0.12, p[0], 1.3, p[1], std(0x6b4a2a)); put(g, new T.SphereGeometry(0.22, 8, 6), std(0xe3c35a), p[0], 1.7, p[1]); });
        cloud(g, -10, 20, -18, 1.8); cloud(g, 12, 22, -20, 2.0);
    };

    // 8. Downtown city around the skyscraper
    ENV.skyscraper = (g, rand, anim) => {
        disc(g, 34, 0x3b3e43, 0.01, 0.95, 0.12);
        // road grid
        road(g, 0, 11.5, 70, 6, 0, true);
        road(g, 0, -11.5, 70, 6, 0, true);
        road(g, 11.5, 0, 70, 6, Math.PI / 2, true);
        road(g, -11.5, 0, 70, 6, Math.PI / 2, true);
        [[8, 11.5, Math.PI / 2], [-8, 11.5, Math.PI / 2], [8, -11.5, Math.PI / 2], [-8, -11.5, Math.PI / 2], [11.5, 8, 0], [11.5, -8, 0], [-11.5, 8, 0], [-11.5, -8, 0]].forEach(c => crosswalk(g, c[0], c[1], c[2]));
        disc(g, 8.8, 0xbfbfb8, 0.04, 0.9);                                              // plaza
        // surrounding blocks
        const kinds = ['glass', 'brick', 'plaster', 'glass'];
        const cols = [0xffffff, 0xb5533c, 0xd8d2c4, 0xffffff];
        let n = 0;
        [[-20, 20], [-8.5, 21], [8.5, 21.5], [20, 20], [-21, 8], [21, 8], [-21, -8], [21, -8], [-20, -20], [-8.5, -21], [8.5, -21.5], [20, -20]].forEach((p, i) => {
            tower(g, p[0], p[1], 5.5 + rand() * 1.5, 5 + rand() * 7, 5.5 + rand() * 1.5, kinds[i % 4], cols[i % 4]); n++;
        });
        // lights, signals, trees
        [[-6, 8.2], [6, 8.2], [-6, -8.2], [6, -8.2], [8.2, 6], [8.2, -6], [-8.2, 6], [-8.2, -6]].forEach(p => streetLamp(g, p[0], p[1], 0));
        trafficLight(g, 8.6, 8.6); trafficLight(g, -8.6, -8.6); trafficLight(g, 8.6, -8.6); trafficLight(g, -8.6, 8.6);
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; tree(g, Math.cos(a) * 7.6, Math.sin(a) * 7.6, 0.55, 'round'); }
        // billboard
        C(g, 0.15, 0.2, 4, 6, -14, 2, 15.5, std(0x555a60, 0.5, 0.6)); B(g, 5, 2.4, 0.2, -14, 5, 15.5, std(0x1f77d0, 0.4)); B(g, 4.4, 0.5, 0.05, -14, 5.3, 15.65, std(0xffffff, 0.4));
        // driving cars
        const cs = [];
        const palette = [0xe74c3c, 0x2e86c1, 0xf1c40f, 0xecf0f1, 0x1a1a1a, 0x27ae60, 0xe67e22];
        for (let i = 0; i < 7; i++) { const c = car(g, 0, 0, 0, palette[i]); c.userData = { axis: i % 4, off: i * 9.7, spd: 2.6 + (i % 3) * 0.7 }; cs.push(c); }
        anim.push((t) => cs.forEach(c => {
            const d = c.userData, p = ((t * d.spd + d.off) % 70) - 35;
            if (d.axis === 0) { c.position.set(p, 0, 12.8); c.rotation.y = Math.PI; }
            else if (d.axis === 1) { c.position.set(-p, 0, -12.8); c.rotation.y = 0; }
            else if (d.axis === 2) { c.position.set(12.8, 0, p); c.rotation.y = Math.PI / 2; }
            else { c.position.set(-12.8, 0, -p); c.rotation.y = -Math.PI / 2; }
            c.position.x *= (d.axis < 2 ? 1 : 1);
        }));
        cloud(g, -14, 28, -22, 2.2); cloud(g, 18, 31, -16, 2.6);
    };

    // Colour of the ground beyond each environment's own disc, so the scene never ends in a hard edge
    const GROUND = { hut: 0x3f7a3f, cottage: 0x78c25a, townhouse: 0x5c9b4d, villa: 0xe9d9a8, mansion: 0x4ea04f, chalet: 0xe8f0f7, castle: 0x5fa24e, skyscraper: 0x3b3e43 };

    function createEnvironment(type) {
        const g = new T.Group();
        const anim = [];
        const seed = { hut: 11, cottage: 22, townhouse: 33, villa: 44, mansion: 55, chalet: 66, castle: 77, skyscraper: 88 }[type] || 5;
        (ENV[type] || ENV.cottage)(g, rngFor(seed), anim);
        return { group: g, update: (t) => anim.forEach(f => f(t)), ground: GROUND[type] === undefined ? 0x78c25a : GROUND[type] };
    }

    // ── Construction site ────────────────────────────────────────────────
    function scaffoldLevel(grp, hw, hd, y0) {
        const m = std(0xb8bcc2, 0.4, 0.8);
        const wood = std(0xc9a36a, 0.9);
        const lvH = 2.2;
        const corners = [];
        const nx = Math.max(2, Math.round(hw * 2 / 2.4)), nz = Math.max(2, Math.round(hd * 2 / 2.4));
        for (let i = 0; i <= nx; i++) { const x = -hw + (i / nx) * hw * 2; corners.push([x, hd], [x, -hd]); }
        for (let i = 1; i < nz; i++) { const z = -hd + (i / nz) * hd * 2; corners.push([hw, z], [-hw, z]); }
        corners.forEach(c => { B(grp, 0.08, lvH, 0.08, c[0], y0 + lvH / 2, c[1], m); });
        // guard rails
        [lvH * 0.5, lvH].forEach(h => {
            B(grp, hw * 2, 0.06, 0.06, 0, y0 + h, hd, m); B(grp, hw * 2, 0.06, 0.06, 0, y0 + h, -hd, m);
            B(grp, 0.06, 0.06, hd * 2, hw, y0 + h, 0, m); B(grp, 0.06, 0.06, hd * 2, -hw, y0 + h, 0, m);
        });
        // cross braces on the front and right faces
        for (let i = 0; i < nx; i++) { const x = -hw + ((i + 0.5) / nx) * hw * 2; const d = B(grp, 0.05, Math.hypot(hw * 2 / nx, lvH) * 1.0, 0.05, x, y0 + lvH / 2, hd, m); d.rotation.z = Math.atan2(hw * 2 / nx, lvH) * (i % 2 ? 1 : -1); }
        // plank deck
        B(grp, hw * 2 + 0.6, 0.1, 0.9, 0, y0 + 0.05, hd + 0.35, wood);
        B(grp, hw * 2 + 0.6, 0.1, 0.9, 0, y0 + 0.05, -hd - 0.35, wood);
        B(grp, 0.9, 0.1, hd * 2 + 0.6, hw + 0.35, y0 + 0.05, 0, wood);
        B(grp, 0.9, 0.1, hd * 2 + 0.6, -hw - 0.35, y0 + 0.05, 0, wood);
    }

    function towerCrane(grp, mastH) {
        const c = new T.Group();
        const steel = std(0xf2b01e, 0.5, 0.4), dark = std(0x4a4f55, 0.5, 0.5);
        B(c, 2.6, 0.6, 2.6, 0, 0.3, 0, std(0x9a9a96, 0.9));
        [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(p => B(c, 0.1, mastH, 0.1, p[0], mastH / 2 + 0.6, p[1], steel));
        for (let y = 0.9; y < mastH; y += 1.0) {
            const k = (Math.round(y) % 2) ? 1 : -1;
            [[0, 0.5], [0, -0.5]].forEach(p => { const d = B(c, 1.2, 0.05, 0.05, 0, y + 0.6, p[1], steel); d.rotation.z = k * 0.78; });
            [[0.5, 0], [-0.5, 0]].forEach(p => { const d = B(c, 0.05, 0.05, 1.2, p[0], y + 0.6, 0, steel); d.rotation.x = k * 0.78; });
        }
        const slew = new T.Group(); slew.position.y = mastH + 0.7; c.add(slew);
        B(slew, 1.2, 0.5, 1.2, 0, 0, 0, dark);
        B(slew, 1.0, 1.0, 1.3, 0.9, 0.9, 0, std(0xffffff, 0.4));                       // cab
        B(slew, 0.6, 0.5, 1.0, 1.0, 1.1, 0.0, std(0x6fb6e6, 0.1, 0.6));
        B(slew, 10, 0.12, 0.12, 5.4, 0.45, 0.42, steel); B(slew, 10, 0.12, 0.12, 5.4, 0.45, -0.42, steel); B(slew, 10, 0.12, 0.12, 5.4, 1.15, 0, steel);
        for (let i = 0; i < 18; i++) { const d = B(slew, 0.6, 0.05, 0.05, 0.6 + i * 0.55, 0.8, 0.42, steel); d.rotation.z = (i % 2 ? 1 : -1) * 0.9; const d2 = B(slew, 0.6, 0.05, 0.05, 0.6 + i * 0.55, 0.8, -0.42, steel); d2.rotation.z = (i % 2 ? 1 : -1) * 0.9; }
        B(slew, 3.2, 0.12, 0.12, -1.8, 0.45, 0.42, steel); B(slew, 3.2, 0.12, 0.12, -1.8, 0.45, -0.42, steel);
        [0, 1, 2].forEach(i => B(slew, 0.7, 0.9, 1.0, -2.5 + i * 0.75, 0.3, 0, std(0x777c82, 0.9)));
        // trolley, cable, load
        const trolley = new T.Group(); trolley.position.set(6.2, 0.3, 0); slew.add(trolley);
        B(trolley, 0.5, 0.2, 0.6, 0, 0, 0, dark);
        const cable = B(trolley, 0.03, 3.0, 0.03, 0, -1.5, 0, dark);
        const load = new T.Group(); load.position.y = -3.1; trolley.add(load);
        B(load, 0.3, 0.3, 0.3, 0, 0.2, 0, dark);
        B(load, 1.2, 0.25, 0.9, 0, -0.1, 0, std(0x8a6a3a));
        B(load, 1.0, 0.7, 0.7, 0, 0.35 - 0.3, 0, std(0xb5533c, 0.9));
        c.userData = { slew, trolley, cable, load, mastH };
        return c;
    }

    function excavator() {
        const e = new T.Group();
        const yel = std(0xf2b01e, 0.5, 0.3), blk = std(0x2a2a2a, 0.9);
        [-0.7, 0.7].forEach(z => B(e, 2.4, 0.5, 0.5, 0, 0.25, z, blk));
        const turret = new T.Group(); turret.position.y = 0.55; e.add(turret);
        B(turret, 1.8, 0.7, 1.4, 0, 0.35, 0, yel);
        B(turret, 0.8, 0.8, 0.9, 0.5, 1.0, -0.2, std(0x6fb6e6, 0.1, 0.6));
        B(turret, 0.6, 0.5, 1.4, -0.8, 0.5, 0, std(0x777c82, 0.9));
        const boom = new T.Group(); boom.position.set(0.9, 0.7, 0); turret.add(boom);
        const b1 = B(boom, 2.2, 0.28, 0.3, 1.0, 0.45, 0, yel); b1.rotation.z = 0.7;
        const stick = new T.Group(); stick.position.set(2.0, 1.4, 0); boom.add(stick);
        const b2 = B(stick, 1.6, 0.22, 0.26, 0.5, -0.3, 0, yel); b2.rotation.z = -0.9;
        const bucket = B(stick, 0.5, 0.4, 0.6, 1.2, -1.1, 0, std(0x555a60, 0.6, 0.4));
        e.userData = { turret, stick, boom };
        return e;
    }

    function hazardTexture() {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
        const g = cv.getContext('2d');
        g.fillStyle = '#f5c518'; g.fillRect(0, 0, 128, 32);
        g.fillStyle = '#1a1a1a';
        for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 48, 0); g.lineTo(x + 32, 0); g.fill(); }
        const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    }

    function createSite(type, bbox) {
        const grp = new T.Group();
        const F = BF();
        const hw = Math.max(1.6, (bbox.max.x - bbox.min.x) / 2);
        const hd = Math.max(1.6, (bbox.max.z - bbox.min.z) / 2);
        const Hh = Math.max(3, bbox.max.y);
        const fx = hw + 4.5, fz = hd + 4.5;

        // dirt pad
        const pad = B(grp, fx * 2, 0.08, fz * 2, 0, 0.045, 0, std(0x8c6b45, 1));
        for (let i = 0; i < 14; i++) B(grp, 0.35, 0.02, fz * 1.4, -fx * 0.8 + i * 0.5 * (fx / 5), 0.095, 0, std(0x6f5434, 1)).rotation.y = 0.15;

        // construction fence with gate and hazard signs
        const fenceM = std(0xff8a1f, 0.7);
        const hz = hazardTexture();
        const addFence = (x1, z1, x2, z2) => {
            const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
            const n = Math.max(1, Math.round(len / 2));
            for (let i = 0; i < n; i++) {
                const t = (i + 0.5) / n;
                const panel = B(grp, len / n - 0.1, 1.5, 0.06, x1 + (x2 - x1) * t, 0.85, z1 + (z2 - z1) * t, new T.MeshStandardMaterial({ color: 0xff9a2f, roughness: 0.7, transparent: true, opacity: 0.88 }), -ang);
                B(grp, len / n - 0.1, 0.1, 0.08, x1 + (x2 - x1) * t, 1.55, z1 + (z2 - z1) * t, fenceM, -ang);
            }
            for (let i = 0; i <= n; i++) { const t = i / n; B(grp, 0.1, 1.7, 0.1, x1 + (x2 - x1) * t, 0.85, z1 + (z2 - z1) * t, std(0x444444, 0.5, 0.6)); }
        };
        addFence(-fx, -fz, fx, -fz); addFence(-fx, -fz, -fx, fz); addFence(fx, -fz, fx, fz);
        addFence(-fx, fz, -2, fz); addFence(2, fz, fx, fz);                         // gap = gate
        [-2, 2].forEach(x => { B(grp, 0.2, 2.4, 0.2, x, 1.2, fz, std(0x444444, 0.5, 0.6)); });
        const sign = B(grp, 3.0, 0.7, 0.06, 0, 2.2, fz, new T.MeshStandardMaterial({ map: hz, roughness: 0.6 }));
        const sign2 = B(grp, 1.8, 0.9, 0.06, -fx / 2, 1.4, fz + 0.05, std(0xffffff, 0.6)); B(grp, 1.6, 0.18, 0.07, -fx / 2, 1.6, fz + 0.06, std(0xd63031, 0.5)); B(grp, 1.4, 0.1, 0.07, -fx / 2, 1.3, fz + 0.06, std(0x2d3436, 0.5));

        // scaffolding that grows with progress
        const levels = Math.min(7, Math.ceil(Hh / 2.2));
        const scaffold = [];
        for (let k = 0; k < levels; k++) { const lv = new T.Group(); scaffoldLevel(lv, hw + 0.8, hd + 0.8, k * 2.2); lv.userData.y0 = k * 2.2; grp.add(lv); scaffold.push(lv); }

        // crane for bigger buildings
        let crane = null;
        if (Hh > 6) {
            crane = towerCrane(grp, Math.min(Hh + 3.5, 17));
            crane.position.set(fx - 1.6, 0, -fz + 1.6);
            crane.scale.setScalar(Hh > 12 ? 1.0 : 0.9);
            grp.add(crane);
        }
        // excavator digging by the fence
        const exc = excavator();
        exc.position.set(-fx + 2.2, 0, fz - 3.0);
        exc.rotation.y = 0.5;
        grp.add(exc);

        // props (cones, crates, pallets, mixer)
        F.createSiteProps(grp, hw + 0.5, hd + 0.5);

        // hammering builder who climbs the scaffold with progress
        // The builder hammering on site is the student's own character (falls back to the stock builder)
        let hammerer;
        try {
            hammerer = (window.BuilderAppearance && window.AvatarFactory)
                ? window.AvatarFactory.createAvatar(window.BuilderAppearance, { hammer: true })
                : null;
        } catch (err) { console.warn('Could not build the player character for the site:', err); }
        if (!hammerer) hammerer = F.createCharacter({ shirt: 0xd35400, hat: 0xffffff, vest: 0xFFD21A, skin: 0xC68642, hair: 0x1a1a1a, hammer: true });
        grp.add(hammerer);
        // a second worker carrying a plank along the front
        const carrier = F.createCharacter({ shirt: 0x16a085, hat: 0xFF7A1A, vest: 0xFF7A1A, skin: 0xF1C27D, hair: 0x5a3b1d });
        const plank = B(carrier, 0.12, 0.12, 2.2, 0.35, 1.9, 0.2, std(0xc9a36a, 0.9)); carrier.userData.parts.lArm.rotation.x = -1.2; carrier.userData.parts.rArm.rotation.x = -1.2;
        grp.add(carrier);

        const state = { y: 0, cx: 0 };
        function update(o) {
            const p = o.progress, t = o.t;
            const showSite = !o.complete;
            grp.visible = showSite;
            if (!showSite) return;
            const builtH = (o.active ? p : 0.0) * Hh;
            // scaffold appears level by level as the building rises
            scaffold.forEach(lv => { lv.visible = lv.userData.y0 <= builtH + 1.2 + (o.active ? 0 : -1.2); });
            // crane: slew, trolley and swinging load
            if (crane) {
                const u = crane.userData;
                u.slew.rotation.y = Math.sin(t * 0.25) * 1.1 + (o.active ? Math.sin(t * 0.6) * 0.1 : 0);
                u.trolley.position.x = 4.8 + Math.sin(t * 0.4) * 2.0;
                const drop = 2.2 + (Math.sin(t * 0.8) + 1) * 1.0;
                u.cable.scale.y = drop / 3.0; u.cable.position.y = -drop / 2;
                u.load.position.y = -drop - 0.1;
                u.load.rotation.z = Math.sin(t * 1.2) * 0.05;
            }
            // excavator arm
            exc.userData.stick.rotation.z = Math.sin(t * 0.9) * 0.35;
            exc.userData.boom.rotation.z = Math.sin(t * 0.9 + 1) * 0.12;
            exc.userData.turret.rotation.y = Math.sin(t * 0.3) * 0.5;
            // hammerer follows the scaffold up the front face
            hammerer.visible = o.active;
            if (o.active) {
                const level = Math.max(0, Math.min(levels - 1, Math.floor(builtH / 2.2)));
                const targetY = level * 2.2 + (level > 0 ? 0.12 : 0.0);
                state.y += (targetY - state.y) * 0.04;
                const sx = Math.sin(t * 0.25) * Math.max(0.5, hw * 0.55);
                hammerer.position.set(sx, state.y, hd + 1.2);
                hammerer.rotation.y = Math.PI;                    // face the wall (-Z)
                const pr = hammerer.userData.parts;
                const swing = Math.sin(t * 9);
                pr.rArm.rotation.x = -1.55 + swing * 0.55;
                pr.lArm.rotation.x = -0.9 + Math.sin(t * 9 + 1) * 0.1;
                pr.head.rotation.x = 0.1;
                hammerer.position.y = state.y + Math.abs(Math.sin(t * 0.7)) * 0.0;
            }
            // carrier walks planks back and forth along the front
            carrier.visible = o.active;
            if (o.active) {
                const span = hw + 2.2;
                const k = (t * 0.12) % 2;
                const x = (k < 1 ? k : 2 - k) * span * 2 - span;
                carrier.position.set(x, 0, hd + 2.4);
                carrier.rotation.y = (k < 1 ? Math.PI / 2 : -Math.PI / 2);
                const pr = carrier.userData.parts;
                const sw = Math.sin(t * 6) * 0.5;
                pr.lLeg.rotation.x = sw; pr.rLeg.rotation.x = -sw;
                carrier.position.y = Math.abs(Math.sin(t * 6)) * 0.04;
            }
        }
        return { group: grp, update, size: { hw, hd, H: Hh } };
    }

    window.EnvironmentFactory = { createEnvironment, createSite };
})();
