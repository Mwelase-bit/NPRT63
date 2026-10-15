// CharacterPreview.jsx - a small live 3D view of the student's character.
//
// Drag (mouse or finger) to turn the character; it also turns slowly by itself and
// breathes and blinks. `view` switches between the whole body and a close-up of the face.
// It owns its own little WebGL renderer, which it cleans up when the screen closes.
// If WebGL is not available it says so instead of leaving an empty box.
const { useState, useEffect, useRef } = React;

const CharacterPreview = ({ look, view = 'full' }) => {
    const mountRef = useRef(null);
    const api = useRef({});                    // live objects shared between effects (renderer, scene, avatar...)
    const [failed, setFailed] = useState('');

    // ── Set up the renderer, lights and render loop once ──────────────────────────
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        const T = window.THREE;
        let renderer;
        try {
            renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        } catch (err) {
            setFailed('3D graphics are not available in this browser, so the character preview cannot be shown.');
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
        mount.appendChild(renderer.domElement);

        const scene = new T.Scene();
        scene.add(new T.HemisphereLight('#dfeaff', '#4a5568', 1.05));
        const sun = new T.DirectionalLight('#fff3dd', 2.3);
        sun.position.set(2.6, 4.5, 4);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -2; sun.shadow.camera.right = 2; sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -1;
        scene.add(sun);
        const rim = new T.DirectionalLight('#8ab4ff', 1.1);
        rim.position.set(-3, 2.5, -3);
        scene.add(rim);

        // a soft disc under the feet so the character stands on something
        const floor = new T.Mesh(new T.CircleGeometry(1.5, 48), new T.MeshStandardMaterial({ color: '#2b3750', roughness: 0.9, transparent: true, opacity: 0.85 }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
        const pivot = new T.Group();                // the avatar sits on this; dragging turns it
        scene.add(pivot);

        const st = { renderer, scene, camera, pivot, T, spin: 0.4, dragging: false, lastX: 0, target: { y: 1.05, z: 6.6 }, cur: { y: 1.05, z: 6.6 }, raf: 0 };
        api.current = st;

        const resize = () => {
            const w = Math.max(1, mount.clientWidth), h = Math.max(1, mount.clientHeight);
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        resize();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        if (ro) ro.observe(mount); else window.addEventListener('resize', resize);

        // drag to turn
        const el = renderer.domElement;
        const down = (e) => { st.dragging = true; st.lastX = e.clientX; el.style.cursor = 'grabbing'; try { el.setPointerCapture(e.pointerId); } catch (x) { /* older browsers */ } };
        const move = (e) => { if (!st.dragging) return; pivot.rotation.y += (e.clientX - st.lastX) * 0.012; st.lastX = e.clientX; };
        const up = () => { st.dragging = false; el.style.cursor = 'grab'; };
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const clock = new T.Clock();
        const loop = () => {
            st.raf = requestAnimationFrame(loop);
            const t = clock.getElapsedTime();
            if (!st.dragging && !reduceMotion) pivot.rotation.y += 0.004 * st.spin;
            // glide the camera between "full body" and "face"
            st.cur.y += (st.target.y - st.cur.y) * 0.08;
            st.cur.z += (st.target.z - st.cur.z) * 0.08;
            camera.position.set(0, st.cur.y + 0.1, st.cur.z);
            camera.lookAt(0, st.cur.y, 0);
            if (st.avatar && st.avatar.userData.animateIdle && !reduceMotion) st.avatar.userData.animateIdle(t);
            renderer.render(scene, camera);
        };
        loop();

        return () => {
            cancelAnimationFrame(st.raf);
            if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
            el.removeEventListener('pointerdown', down);
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            if (st.avatar) window.AvatarFactory.disposeAvatar(st.avatar);
            floor.geometry.dispose(); floor.material.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            api.current = {};
        };
    }, []);

    // ── Rebuild the character whenever the look changes ───────────────────────────
    const lookKey = JSON.stringify(look || {});
    useEffect(() => {
        const st = api.current;
        if (!st || !st.pivot) return;
        try {
            if (st.avatar) { st.pivot.remove(st.avatar); window.AvatarFactory.disposeAvatar(st.avatar); }
            st.avatar = window.AvatarFactory.createAvatar(look);
            st.pivot.add(st.avatar);
        } catch (err) {
            console.error('Could not build the character:', err);
            setFailed('The character could not be drawn. Try changing an option, or reload the page.');
        }
    }, [lookKey, failed]);

    // ── Camera preset ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const st = api.current;
        if (!st || !st.target) return;
        st.target = view === 'face' ? { y: 1.95, z: 2.1 } : { y: 1.05, z: 6.6 };
    }, [view]);

    if (failed) return <div className="cp-fallback" role="alert">{failed}</div>;
    return <div className="cp-view" ref={mountRef} aria-label="Your character. Drag to turn it." role="img" />;
};

window.CharacterPreview = CharacterPreview;
