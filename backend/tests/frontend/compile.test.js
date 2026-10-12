// Validation: every script index.html loads must compile with the SAME Babel
// build and config the browser uses, and every global the mount poller waits
// for must actually be assigned somewhere. A failure here is exactly what shows
// up in the browser as the "blue loading screen that never finishes".
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const Babel = require(path.join(ROOT, 'vendor', 'babel.min.js'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Same iife-wrap plugin index.html registers
const iifeWrap = ({ types: t }) => ({
    visitor: {
        Program: {
            exit(p) {
                const stmts = p.node.body;
                if (!stmts.length) return;
                p.node.body = [t.expressionStatement(t.callExpression(t.functionExpression(null, [], t.blockStatement(stmts)), []))];
            }
        }
    }
});
const compile = (code, filename) => Babel.transform(code, {
    filename,
    presets: [[Babel.availablePresets.react, { runtime: 'classic' }]],
    plugins: [iifeWrap]
}).code;

const scriptSrcs = [...html.matchAll(/<script[^>]+type="text\/babel"[^>]+src="([^"?]+)(\?v=([^"]+))?"/g)]
    .map(m => ({ src: m[1], version: m[3] }));

describe('index.html script manifest', () => {
    test('loads a non-trivial number of scripts', () => {
        assert.ok(scriptSrcs.length >= 20, `only found ${scriptSrcs.length}`);
    });

    for (const { src } of scriptSrcs) {
        test(`${src} exists and compiles`, () => {
            const file = path.join(ROOT, src);
            assert.ok(fs.existsSync(file), `${src} is referenced by index.html but missing`);
            assert.doesNotThrow(() => compile(fs.readFileSync(file, 'utf8'), src));
        });
    }

    test('inline <script type="text/babel"> blocks compile', () => {
        const inline = [...html.matchAll(/<script type="text\/babel" data-presets(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
            .map(m => m[1]).filter(s => s.trim());
        assert.ok(inline.length >= 2);
        inline.forEach((code, i) => assert.doesNotThrow(() => compile(code, `inline-${i}.jsx`)));
    });

    test('every global the mount poller waits for is assigned by some loaded script', () => {
        const required = JSON.parse(html.match(/const REQUIRED = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
        const allCode = scriptSrcs.map(s => fs.readFileSync(path.join(ROOT, s.src), 'utf8')).join('\n') + html;
        for (const name of required) {
            assert.match(allCode, new RegExp(`window\\.${name}\\s*=`), `window.${name} is never assigned — the app would never mount`);
        }
    });

    test('changed assets carry a cache-busting version newer than the stale 20260617/19 builds', () => {
        // Browsers were serving stale copies of these files, so a fix in them never reached users.
        for (const f of ['src/App.jsx', 'src/utils/sounds.js', 'src/components/UI/StudyPanel.jsx', 'src/components/GameScene.jsx']) {
            const s = scriptSrcs.find(x => x.src === f);
            assert.ok(s && s.version && s.version > '20260619z', `${f} version is ${s && s.version}`);
        }
        const css = html.match(/App\.css\?v=([^"]+)/)[1];
        assert.ok(css > '20260619z', `App.css version is ${css}`);
    });
});
