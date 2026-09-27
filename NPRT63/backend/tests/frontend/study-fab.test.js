// Validation: Study AI floating button (FAB) — one logo used everywhere, one FAB
// instance for the whole app, and a smaller, less distracting close button.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const app = read('src/App.jsx');
const panel = read('src/components/UI/StudyPanel.jsx');
const css = read('src/styles/App.css');
const html = read('index.html');

// Pull a CSS rule body by exact selector (last definition wins, like the browser)
function rule(selector) {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...css.matchAll(new RegExp(`(^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))];
    return matches.length ? matches[matches.length - 1][2] : null;
}
const px = (body, prop) => {
    const m = body && body.match(new RegExp(`(^|[\\s;])${prop}\\s*:\\s*([\\d.]+)px`));
    return m ? parseFloat(m[2]) : null;
};

describe('Study logo is a single shared component', () => {
    test('StudyLogo is defined once and exported on window', () => {
        assert.match(panel, /const StudyLogo\s*=/);
        assert.match(panel, /window\.StudyLogo\s*=\s*StudyLogo/);
    });

    test('the pixel-house SVG artwork exists in exactly one place in the codebase', () => {
        const files = ['src/App.jsx', 'src/components/UI/StudyPanel.jsx', 'src/components/GameScene.jsx'];
        const copies = files.reduce((n, f) => n + (read(f).match(/fill="#b33a3a"/g) || []).length, 0);
        assert.equal(copies, 1, `found ${copies} copies of the logo artwork`);
    });

    test('FAB, Study AI nav tab and Study panel header all render <StudyLogo>', () => {
        const fab = panel.slice(panel.indexOf('study-panel-fab'), panel.indexOf('</button>', panel.indexOf('study-panel-fab')));
        assert.match(fab, /<StudyLogo/, 'FAB does not use StudyLogo');
        assert.match(panel.slice(panel.indexOf('study-header')), /<StudyLogo/, 'panel header does not use StudyLogo');
        const navTab = (app.match(/<button[^]*?nav-tab-study[^]*?<\/button>/) || [''])[0];
        assert.ok(navTab.includes('Study AI'), 'could not find the Study AI nav tab');
        assert.match(navTab, /<StudyLogo/, 'Study AI nav tab still uses a different icon');
        assert.ok(!/🧠 Study AI/.test(app), 'nav tab still shows the 🧠 emoji instead of the logo');
    });
});

describe('One FAB for the whole app', () => {
    test('StudyPanel is rendered exactly once in App (not once per screen)', () => {
        const count = (app.match(/<StudyPanel\b/g) || []).length;
        assert.equal(count, 1, `StudyPanel rendered ${count} times — FAB jumps/re-mounts between screens and loses state`);
    });

    test('the FAB is not rendered inside .panel-content, .ui-overlay or the timer layout', () => {
        // Walk the real JSX tree: collect the classNames / conditions wrapping <StudyPanel>
        const Babel = require(path.join(ROOT, 'vendor', 'babel.min.js'));
        const ancestors = [];
        Babel.transform(app, {
            filename: 'App.jsx',
            code: false,
            presets: [[Babel.availablePresets.react, { runtime: 'classic' }]],
            plugins: [() => ({ visitor: { JSXOpeningElement(p) {
                if (p.node.name.name !== 'StudyPanel') return;
                let cur = p.parentPath.parentPath; // skip <StudyPanel> itself
                while (cur) {
                    if (cur.isJSXElement()) {
                        const cls = cur.node.openingElement.attributes.find(a => a.name && a.name.name === 'className');
                        ancestors.push(cls && cls.value && cls.value.value ? cls.value.value : cur.node.openingElement.name.name);
                    }
                    if (cur.isConditionalExpression()) ancestors.push('?:');
                    cur = cur.parentPath;
                }
            } } })]
        });
        assert.ok(ancestors.length > 0, 'StudyPanel not found');
        for (const bad of ['panel-content', 'ui-overlay', '?:']) {
            assert.ok(!ancestors.includes(bad), `StudyPanel is nested inside ${bad}: ${ancestors.join(' < ')}`);
        }
        assert.equal(ancestors[0], 'app', 'StudyPanel should be a direct child of the app root');
    });

    test('open/close state is controlled by App so the nav tab and FAB stay in sync', () => {
        assert.match(app, /isOpen=\{studyOpen\}/);
        assert.match(app, /onOpenChange=\{setStudyOpen\}/);
    });

    test('Escape closes the panel, and keyboard shortcuts are inactive while it is closed', () => {
        assert.match(panel, /'Escape'/);
        assert.match(panel, /if \(!isOpen \|\| view !== 'study'\) return;/);
    });
});

describe('Close (✕) button sizing', () => {
    const closed = rule('.study-panel-fab');
    const open = rule('.study-panel-fab.study-panel-fab-open');
    const glyph = rule('.study-panel-fab-close');

    test('closed FAB keeps its 76px size', () => {
        assert.equal(px(closed, 'width'), 76);
        assert.equal(px(closed, 'height'), 76);
    });

    test('open-state (close) button is ~45% smaller than the FAB', () => {
        assert.ok(open, 'no .study-panel-fab.study-panel-fab-open rule');
        const w = px(open, 'width'), h2 = px(open, 'height');
        const shrink = 1 - w / 76;
        assert.ok(shrink >= 0.40 && shrink <= 0.50, `close button is ${w}px → ${(shrink * 100).toFixed(0)}% smaller`);
        assert.equal(w, h2, 'close button should stay square');
    });

    test('✕ glyph scales down by the same ~45%', () => {
        const size = px(glyph, 'font-size');
        const shrink = 1 - size / 28;
        assert.ok(shrink >= 0.40 && shrink <= 0.50, `✕ is ${size}px → ${(shrink * 100).toFixed(0)}% smaller`);
    });

    test('the smaller close button stays anchored to the same corner (centred on the FAB spot)', () => {
        const right = px(open, 'right'), bottom = px(open, 'bottom');
        const w = px(open, 'width');
        assert.equal(right + w / 2, 24 + 76 / 2, 'horizontal centre moved');
        assert.equal(bottom + w / 2, 24 + 76 / 2, 'vertical centre moved');
    });

    test('the hover grow effect is toned down on the close button', () => {
        const hover = rule('.study-panel-fab.study-panel-fab-open:hover');
        assert.ok(hover && /scale\(1(\.0\d)?\)/.test(hover), 'close button still pops on hover');
    });
});

test('index.html version-busts StudyPanel.jsx so browsers pick up the change', () => {
    assert.ok(!/StudyPanel\.jsx\?v=20260617a/.test(html));
});
