// End-to-end UI checks in a real browser (Chromium via Playwright).
// Optional: run `npm i -D playwright && npx playwright install chromium`, then
// `npm run test:e2e`. Skips cleanly when Playwright isn't installed.
//
// Boots the real app on port 3001 (the port src/utils/api.js expects in dev)
// with the in-memory test database, logs a user in and checks:
//   • one Study FAB, same logo, same spot on every screen and during a session
//   • the close (✕) button is ~45% smaller than the FAB
//   • every time/number slider uses the same thin style
//   • panel text has solid contrast (no glow/blur)
//   • clicking the scene during a build collapses it AND plays the crash sound
process.env.TEST_PORT = process.env.TEST_PORT || '3001';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* optional dependency */ }
const skip = chromium ? false : 'playwright is not installed (npm i -D playwright)';

let browser, page, user;

before(async () => {
    if (skip) return;
    await h.start();
    user = await h.registerUser({ name: 'E2E Builder' });
    browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
    });
    page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
    // Software-rendered WebGL (CI, VMs) can be very slow — be patient.
    page.setDefaultTimeout(Number(process.env.E2E_TIMEOUT) || 120000);
    // Record every Web Audio source start + every SoundManager call
    await page.addInitScript(() => {
        window.__sounds = [];
        window.__audioStarts = 0;
        const wrap = (proto) => {
            const orig = proto.start;
            proto.start = function (...a) { window.__audioStarts++; return orig.apply(this, a); };
        };
        // AudioBufferSourceNode defines its own start(), so wrap both
        if (window.AudioScheduledSourceNode) wrap(AudioScheduledSourceNode.prototype);
        if (window.AudioBufferSourceNode) wrap(AudioBufferSourceNode.prototype);
        const iv = setInterval(() => {
            const SM = window.SoundManager;
            if (!SM || SM.__wrapped) return;
            for (const k of Object.keys(SM)) {
                if (typeof SM[k] === 'function' && !['toggle', 'isEnabled'].includes(k)) {
                    const f = SM[k];
                    SM[k] = (...a) => { window.__sounds.push(k); return f(...a); };
                }
            }
            SM.__wrapped = true;
            clearInterval(iv);
        }, 20);
    });
    await page.goto(`${h.baseUrl}/`);
    await page.evaluate(t => localStorage.setItem('buildersFocus_token', t), user.token);
    await page.goto(`${h.baseUrl}/`);
    await page.waitForSelector('.nav-tab', { timeout: 30000 });
});

after(async () => {
    if (skip) return;
    if (browser) await browser.close();
    await h.stop();
});

const fabBox = () => page.locator('.study-panel-fab').boundingBox();

describe('Study AI floating button', { skip }, () => {
    test('exactly one FAB, same logo and same position on every screen', async () => {
        const first = await fabBox();
        for (const tab of ['Focus', 'Rewards', 'Profile', 'Community', 'Shop']) {
            await page.locator('.nav-tab', { hasText: tab }).first().click();
            assert.equal(await page.locator('.study-panel-fab').count(), 1, `${tab}: FAB count`);
            assert.equal(await page.locator('.study-panel-fab svg.study-logo').count(), 1, `${tab}: FAB logo`);
            assert.deepEqual(await fabBox(), first, `${tab}: FAB moved`);
        }
    });

    test('nav tab, FAB and panel header use the identical logo artwork', async () => {
        await page.locator('.nav-tab-study').click();
        await page.waitForSelector('.study-panel-floating');
        const svgs = await page.$$eval('svg.study-logo', els => els.map(e => e.innerHTML.replace(/<title>.*?<\/title>/, '')));
        assert.ok(svgs.length >= 2, `found ${svgs.length} logos`);
        assert.ok(svgs.every(s => s === svgs[0]), 'logo artwork differs between places');
    });

    test('close button is ~45% smaller and sits on the FAB spot; Escape closes', async () => {
        const open = await fabBox();
        assert.ok(Math.abs(open.width - 42) <= 1, `close button is ${open.width}px`);
        await page.keyboard.press('Escape');
        await page.waitForSelector('.study-panel-floating', { state: 'detached' });
        const closed = await fabBox();
        assert.ok(Math.abs(closed.width - 76) <= 1);
        const c1 = [open.x + open.width / 2, open.y + open.height / 2];
        const c2 = [closed.x + closed.width / 2, closed.y + closed.height / 2];
        assert.ok(Math.abs(c1[0] - c2[0]) <= 1 && Math.abs(c1[1] - c2[1]) <= 1, 'centre moved');
    });
});

describe('Consistent, readable panels', { skip }, () => {
    test('every slider in the app renders the same thin track', async () => {
        await page.locator('.nav-tab', { hasText: 'Focus' }).first().click();
        const focus = await page.$eval('input[type=range]', el => ({ h: el.getBoundingClientRect().height, bg: getComputedStyle(el).backgroundColor }));
        await page.locator('.nav-tab-study').click();
        await page.locator('.study-tab', { hasText: 'Generate' }).click();
        const study = await page.$eval('.study-panel input[type=range]', el => ({ h: el.getBoundingClientRect().height, bg: getComputedStyle(el).backgroundColor }));
        await page.keyboard.press('Escape');
        for (const s of [focus, study]) {
            assert.ok(s.h <= 24, `slider box is ${s.h}px tall`);
            assert.equal(s.bg, 'rgba(0, 0, 0, 0)', 'slider draws a thick background bar');
        }
    });

    test('panel headings have no text glow and every panel shares one surface', async () => {
        const seen = new Set();
        const panels = { Focus: 'timer-panel', Rewards: 'reward-panel', Profile: 'profile-panel', Community: 'community-panel', Shop: 'shop-panel' };
        for (const [tab, cls] of Object.entries(panels)) {
            await page.locator('.nav-tab', { hasText: tab }).first().click();
            await page.waitForSelector(`.${cls} h2`); // wait out any loading state
            const info = await page.$eval(`.${cls}`, el => ({
                bg: getComputedStyle(el).backgroundColor,
                h2Shadow: getComputedStyle(el.querySelector('h2')).textShadow
            }));
            assert.equal(info.h2Shadow, 'none', `${tab} heading has a glow`);
            seen.add(info.bg);
        }
        assert.equal(seen.size, 1, `panels use ${seen.size} different backgrounds: ${[...seen].join(' | ')}`);
    });
});

describe('Building collapse sound', { skip }, () => {
    test('clicking the scene during a session collapses the building and plays the crash', async (t) => {
        await page.locator('.nav-tab', { hasText: 'Focus' }).first().click();
        await page.locator('.start-btn').click();
        await page.waitForSelector('.timer-active');
        const webgl = await page.evaluate(() => !!document.querySelector('.game-canvas canvas'));
        if (!webgl) return t.skip('no WebGL in this browser — 3D scene (and its click handler) not running');
        await page.waitForTimeout(500);
        const before = await page.evaluate(() => window.__audioStarts);
        await page.mouse.click(683, 200); // empty sky, away from any UI
        await page.waitForFunction(() => window.__sounds.includes('demolish'), null, { timeout: 30000 });
        const after = await page.evaluate(() => window.__audioStarts);
        assert.ok(after - before >= 5, `only ${after - before} audio sources started for the crash`);
        const calls = await page.evaluate(() => window.__sounds.filter(s => s === 'demolish').length);
        assert.equal(calls, 1, 'demolish played more than once');

        // The interrupted session is now recorded on the backend
        let sessions = [];
        for (let i = 0; i < 40 && !sessions.length; i++) {
            sessions = (await h.req('GET', '/api/sessions', undefined, user.token)).data.sessions || [];
            if (!sessions.length) await new Promise(r => setTimeout(r, 250));
        }
        assert.equal(sessions.length, 1, 'interrupted session was not saved');
        assert.equal(sessions[0].completed, false);
    });
});
