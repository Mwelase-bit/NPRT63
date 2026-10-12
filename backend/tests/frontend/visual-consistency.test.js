// Validation: visual consistency — every panel shares the Focus Session look,
// every slider is the same thin style, and nothing makes text blurry.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('src/styles/App.css');
const UI = 'src/components/UI';
const liveComponents = fs.readdirSync(path.join(ROOT, UI))
    .filter(f => f.endsWith('.jsx') && !/_Old\.jsx$/.test(f))
    .map(f => ({ f, src: read(`${UI}/${f}`) }));

const PANELS = ['timer-panel', 'reward-panel', 'profile-panel', 'community-panel', 'shop-panel', 'achievement-panel'];

describe('One panel look everywhere', () => {
    test('the shared theme block styles every panel with the same surface tokens', () => {
        const themeStart = css.indexOf('BUILDHAUS panel theme');
        assert.ok(themeStart > -1, 'panel theme block missing');
        const theme = css.slice(themeStart);
        const surfaceRule = theme.match(/([^{}]+)\{\s*background: var\(--panel-bg\);/);
        assert.ok(surfaceRule, 'no rule applies var(--panel-bg)');
        for (const p of PANELS) assert.ok(surfaceRule[1].includes(`.${p}`), `.${p} is not on the shared panel surface`);
    });

    test('the Study AI panel uses the same surface tokens', () => {
        assert.match(css, /\.study-panel \{\s*background: var\(--panel-bg\);/);
    });

    test('panel text colours meet WCAG AA contrast on the panel background', () => {
        // Panel bg rgba(15,23,42,0.86) over the brightest scene colour (sky #87CEEB) ≈ #1f2c43
        const lum = (hex) => {
            const [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255)
                .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const ink = css.match(/--ink:\s*(#[0-9a-f]{6})/i)[1];
        const muted = css.match(/--ink-muted:\s*(#[0-9a-f]{6})/i)[1];
        assert.ok(ratio(ink, '#1f2c43') >= 7, `heading ink contrast ${ratio(ink, '#1f2c43').toFixed(1)}:1`);
        assert.ok(ratio(muted, '#1f2c43') >= 4.5, `muted text contrast ${ratio(muted, '#1f2c43').toFixed(1)}:1`);
    });

    test('no global white text-shadow halo on body text (made everything look blurry)', () => {
        const body = css.match(/\nbody\s*\{([^}]*)\}/);
        const decls = body ? body[1].replace(/\/\*[\s\S]*?\*\//g, '') : '';
        assert.ok(body && !/text-shadow\s*:/.test(decls), 'body still has a text-shadow');
        assert.match(css, /text-shadow: none !important/);
    });
});

describe('Time / number sliders', () => {
    test('every range input in the live UI uses the shared thin .app-slider', () => {
        let count = 0;
        for (const { f, src } of liveComponents) {
            // Find each <input ... /> element, skipping over {...} expressions so
            // arrow functions like `(e) => ...` don't end the match early.
            let i = 0;
            while ((i = src.indexOf('<input', i)) !== -1) {
                let j = i, depth = 0;
                for (; j < src.length; j++) {
                    const ch = src[j];
                    if (ch === '{') depth++;
                    else if (ch === '}') depth--;
                    else if (ch === '>' && depth === 0) break;
                }
                const tag = src.slice(i, j + 1);
                i = j + 1;
                if (!/type="range"/.test(tag)) continue;
                count++;
                assert.match(tag, /className="[^"]*\bapp-slider\b/, `${f}: range input without app-slider`);
            }
        }
        assert.ok(count >= 2, `expected the Focus and Study sliders, found ${count}`);
    });

    test('.app-slider draws a 4px track with a transparent, non-thick input box', () => {
        const input = css.match(/input\[type="range"\]\.app-slider \{([^}]*)\}/)[1];
        assert.match(input, /background: transparent/);
        const track = css.match(/input\[type="range"\]\.app-slider::-webkit-slider-runnable-track \{([^}]*)\}/)[1];
        assert.match(track, /height: 4px/);
    });

    test('the mobile 44px tap-target rule cannot turn the slider into a thick bar', () => {
        // app-slider must out-specify `input[type="range"]` and `.minutes-slider` backgrounds
        assert.match(css, /input\[type="range"\]\.app-slider \{[^}]*background: transparent/);
    });
});
