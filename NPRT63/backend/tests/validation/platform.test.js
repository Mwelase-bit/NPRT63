// Validation: server-wide behaviour — health, 404s, body parsing, static files
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);

describe('Health & routing', () => {
    test('GET /api/health lists every AI route that actually exists', async () => {
        const r = await h.req('GET', '/api/health');
        assert.equal(r.status, 200);
        assert.equal(r.data.status, 'ok');
        for (const route of ['POST   /api/ai/quiz', 'POST   /api/ai/quiz/attempt']) {
            assert.ok(r.data.endpoints.includes(route), `health endpoint list is missing "${route}"`);
        }
    });

    test('unknown API route → JSON 404', async () => {
        const r = await h.req('GET', '/api/does-not-exist');
        assert.equal(r.status, 404);
        assert.match(r.data.error, /not found/);
    });
});

describe('Request body handling', () => {
    test('malformed JSON → 400 with a helpful message (not a 500 "System Error")', async () => {
        const r = await h.req('POST', '/api/auth/login', '{"email": "a@b.co", "password": ', undefined, { raw: true });
        assert.equal(r.status, 400, `got ${r.status}: ${JSON.stringify(r.data)}`);
    });

    test('bodies over 2 MB → 413', async () => {
        const r = await h.req('POST', '/api/auth/login', { email: 'a@b.co', password: 'x'.repeat(2.2 * 1024 * 1024) });
        assert.equal(r.status, 413, `got ${r.status}`);
    });
});

describe('Static files', () => {
    test('the app shell and its assets are served', async () => {
        for (const p of ['/', '/src/App.jsx', '/src/utils/sounds.js', '/vendor/react.production.min.js']) {
            const r = await h.req('GET', p);
            assert.equal(r.status, 200, `${p} → ${r.status}`);
        }
    });

    const privatePaths = [
        '/backend/.env',
        '/backend/database.js',
        '/backend/routes/auth.js',
        '/package.json',
        '/render.yaml',
        '/.git/config',
        '/node_modules/jsonwebtoken/package.json',
        '/BUILDHAUS_Proposal.md',
    ];
    for (const p of privatePaths) {
        test(`does not serve ${p}`, async () => {
            const r = await h.req('GET', p);
            assert.notEqual(r.status, 200, `${p} is publicly downloadable`);
        });
    }
});
