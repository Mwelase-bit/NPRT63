// backend/tests/helpers/harness.js
// Boots the REAL Express app (backend/app.js) on an ephemeral port, wired to an
// in-memory SQLite database via pg-sqlite-shim, with the Groq API mocked.
// Each test file runs in its own process under `node --test`, so every file
// gets a fresh, isolated database.

const path = require('path');
const { Pool, isAvailable } = require('./pg-sqlite-shim');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://shim/test';
process.env.GROQ_API_KEY = 'test-groq-key';

const BACKEND = path.join(__dirname, '..', '..');

// ── Mock Groq: tests queue the raw text the "model" should reply with ─────────
const groq = {
    replies: [],      // queue of strings (or { status, body })
    calls: [],        // captured request bodies
    reply(content) { this.replies.push(content); },
    reset() { this.replies = []; this.calls = []; }
};

const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
    if (String(url).includes('api.groq.com')) {
        groq.calls.push(JSON.parse(opts.body || '{}'));
        const next = groq.replies.shift();
        if (next && typeof next === 'object' && next.status) {
            return new Response(next.body || 'upstream error', { status: next.status });
        }
        const content = next === undefined ? '[]' : next;
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });
    }
    return realFetch(url, opts);
};

let server, baseUrl, pool;

async function start() {
    if (!isAvailable()) {
        throw new Error('node:sqlite unavailable — run the validation suite with Node.js 22.13 or newer.');
    }
    // Swap the `pg` driver for the SQLite shim BEFORE database.js is loaded,
    // so the real schema + seed SQL in database.js runs unchanged.
    const pgPath = require.resolve('pg', { paths: [BACKEND] });
    require.cache[pgPath] = { id: pgPath, filename: pgPath, loaded: true, exports: { Pool } };
    const database = require(path.join(BACKEND, 'database.js'));
    pool = database.pool;
    const { initDatabase } = database;

    await initDatabase();
    const app = require(path.join(BACKEND, 'app.js'));
    await new Promise(resolve => { server = app.listen(Number(process.env.TEST_PORT) || 0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    return { baseUrl, pool };
}

async function stop() {
    if (server) await new Promise(r => server.close(r));
    if (pool) await pool.end();
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function req(method, urlPath, body, token, { raw } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await realFetch(`${baseUrl}${urlPath}`, {
        method,
        headers,
        body: body === undefined ? undefined : (raw ? body : JSON.stringify(body))
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data, headers: r.headers };
}

let userCounter = 0;
async function registerUser(overrides = {}) {
    userCounter += 1;
    const body = {
        name: `Tester ${userCounter}`,
        email: `tester${userCounter}_${Date.now()}@spu.ac.za`,
        password: 'pass1234',
        faculty: 'nas',
        ...overrides
    };
    const r = await req('POST', '/api/auth/register', body);
    if (r.status !== 201) throw new Error(`registerUser failed: ${r.status} ${JSON.stringify(r.data)}`);
    return { token: r.data.token, user: r.data.user, password: body.password, email: body.email };
}

// Direct DB access for arranging state that has no public endpoint
const db = {
    query: (...a) => pool.query(...a),
    setCoins: (userId, coins) => pool.query('UPDATE users SET coins = $1 WHERE id = $2', [coins, userId]),
    user: async (userId) => (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0]
};

module.exports = { start, stop, req, registerUser, groq, db, get baseUrl() { return baseUrl; } };
