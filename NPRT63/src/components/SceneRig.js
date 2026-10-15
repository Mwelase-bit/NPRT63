// SceneRig.js - shared look for the 3D world: renderer settings, sun + sky
// lighting, soft shadows, a gradient sky dome and a ground plane whose colour
// follows the environment. Exposes window.SceneRig.
(function () {
    const T = window.THREE;

    // Filmic tone mapping keeps bright snow and white walls from clipping
    function configureRenderer(renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        if ('outputColorSpace' in renderer && T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    }

    function addSky(scene) {
        const mat = new T.ShaderMaterial({
            uniforms: {
                topColor: { value: new T.Color(0x4f9fe0) },
                midColor: { value: new T.Color(0x9fd0f2) },
                bottomColor: { value: new T.Color(0xe6f3fb) }
            },
            vertexShader: `
                varying vec3 vPos;
                void main() {
                    vPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
                varying vec3 vPos;
                void main() {
                    float h = clamp(normalize(vPos).y, 0.0, 1.0);
                    vec3 c = mix(bottomColor, midColor, smoothstep(0.0, 0.22, h));
                    c = mix(c, topColor, smoothstep(0.18, 0.85, h));
                    gl_FragColor = vec4(c, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
            side: T.BackSide, depthWrite: false, fog: false
        });
        const sky = new T.Mesh(new T.SphereGeometry(450, 32, 24), mat);
        sky.name = 'sky';
        scene.add(sky);
        return sky;
    }

    function addLights(scene) {
        scene.add(new T.AmbientLight(0xffffff, 0.22));
        scene.add(new T.HemisphereLight(0xcfe8ff, 0x8a9a6a, 0.85));

        const sun = new T.DirectionalLight(0xfff0d2, 2.3);
        sun.position.set(34, 42, 24);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const s = sun.shadow.camera;
        s.near = 5; s.far = 140; s.left = -42; s.right = 42; s.top = 42; s.bottom = -42;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.radius = 3;
        scene.add(sun);

        const fill = new T.DirectionalLight(0xbcd6ff, 0.45);   // cool fill from the opposite side, no shadows
        fill.position.set(-28, 16, -20);
        scene.add(fill);
        return sun;
    }

    // Fine speckle so the far ground isn't one flat colour
    function groundMap() {
        const S = 256, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const c = cv.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, S, S);
        for (let i = 0; i < 4000; i++) {
            const v = Math.round(255 * (1 - Math.random() * 0.16));
            c.fillStyle = `rgb(${v},${v},${v})`;
            const w = 1 + Math.random() * 4;
            c.fillRect(Math.random() * S, Math.random() * S, w, w);
        }
        const t = new T.CanvasTexture(cv);
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(70, 70);
        if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
        return t;
    }

    // A wide ground disc under everything; the environment sets its colour
    function setGround(scene, color) {
        let g = scene.userData.ground;
        if (!g) {
            g = new T.Mesh(new T.CircleGeometry(440, 64), new T.MeshStandardMaterial({ color: 0x6fbf5a, roughness: 1, metalness: 0, map: groundMap() }));
            g.rotation.x = -Math.PI / 2;
            g.position.y = -0.06;
            g.receiveShadow = true;
            scene.add(g);
            scene.userData.ground = g;
        }
        if (color !== undefined) g.material.color.setHex(color);
        return g;
    }

    function setup(scene) {
        addSky(scene);
        addLights(scene);
        setGround(scene);
        scene.fog = new T.Fog(0xdcecf8, 120, 430);
    }

    window.SceneRig = { configureRenderer, setup, setGround };
})();
