// Validation: registration, login, token handling, profile & password changes
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);

describe('POST /api/auth/register', () => {
    test('rejects missing fields with 400', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'X', email: 'x@spu.ac.za' });
        assert.equal(r.status, 400);
        assert.match(r.data.error, /password/);
    });

    test('rejects an invalid email', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Test', email: 'not-an-email', password: 'pass1234', faculty: 'nas' });
        assert.equal(r.status, 400);
    });

    test('rejects an invalid faculty', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Test', email: 'f@spu.ac.za', password: 'pass1234', faculty: 'law' });
        assert.equal(r.status, 400);
    });

    test('rejects passwords shorter than 6 characters', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Test', email: 'p@spu.ac.za', password: '123', faculty: 'nas' });
        assert.equal(r.status, 400);
    });

    test('rejects an invalid gender instead of crashing on the DB CHECK constraint', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Test', email: 'g@spu.ac.za', password: 'pass1234', faculty: 'nas', gender: 'robot' });
        assert.equal(r.status, 400, `expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
    });

    test('rejects non-string fields (e.g. an object as the password) with 400, not 500', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Test', email: 'o@spu.ac.za', password: { a: 1 }, faculty: 'nas' });
        assert.equal(r.status, 400, `expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
    });

    test('registers a valid user, returns a token and never leaks the password hash', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Valid User', email: 'Valid.User@SPU.ac.za', password: 'pass1234', faculty: 'edu' });
        assert.equal(r.status, 201);
        assert.ok(r.data.token);
        assert.equal(r.data.user.email, 'valid.user@spu.ac.za', 'email is normalised to lower case');
        assert.equal(r.data.user.password, undefined);
        assert.equal(r.data.user.coins, 100, 'new users start with 100 coins');
    });

    test('rejects a duplicate email (case-insensitive) with 409', async () => {
        const r = await h.req('POST', '/api/auth/register', { name: 'Dup', email: 'VALID.USER@spu.ac.za', password: 'pass1234', faculty: 'nas' });
        assert.equal(r.status, 409);
    });

    test('rejects a duplicate student number with 409', async () => {
        await h.registerUser({ student_no: '202400001' });
        const r = await h.req('POST', '/api/auth/register', { name: 'Twin', email: 'twin@spu.ac.za', password: 'pass1234', faculty: 'nas', student_no: '202400001' });
        assert.equal(r.status, 409);
    });
});

describe('POST /api/auth/login', () => {
    test('wrong password → 401 with a generic message', async () => {
        const u = await h.registerUser();
        const r = await h.req('POST', '/api/auth/login', { email: u.email, password: 'wrong-password' });
        assert.equal(r.status, 401);
        assert.equal(r.data.error, 'Invalid email or password.');
    });

    test('unknown email → same 401 (no account enumeration)', async () => {
        const r = await h.req('POST', '/api/auth/login', { email: 'nobody@spu.ac.za', password: 'whatever1' });
        assert.equal(r.status, 401);
        assert.equal(r.data.error, 'Invalid email or password.');
    });

    test('valid login returns token, user without hash, and owned items', async () => {
        const u = await h.registerUser();
        const r = await h.req('POST', '/api/auth/login', { email: u.email.toUpperCase(), password: u.password });
        assert.equal(r.status, 200);
        assert.ok(r.data.token);
        assert.equal(r.data.user.password, undefined);
        assert.ok(Array.isArray(r.data.ownedItems));
    });
});

describe('Token handling (GET /api/auth/me)', () => {
    test('no token → 401', async () => {
        const r = await h.req('GET', '/api/auth/me');
        assert.equal(r.status, 401);
    });

    test('garbage token → 401', async () => {
        const r = await h.req('GET', '/api/auth/me', undefined, 'not.a.jwt');
        assert.equal(r.status, 401);
    });

    test('token signed with a different secret → 401', async () => {
        const forged = jwt.sign({ id: 1, email: 'x@y.z', faculty: 'nas' }, 'someone-elses-secret');
        const r = await h.req('GET', '/api/auth/me', undefined, forged);
        assert.equal(r.status, 401);
    });

    test('expired token → 401', async () => {
        const u = await h.registerUser();
        const expired = jwt.sign({ id: u.user.id, email: u.email, faculty: 'nas' }, process.env.JWT_SECRET, { expiresIn: -10 });
        const r = await h.req('GET', '/api/auth/me', undefined, expired);
        assert.equal(r.status, 401);
    });

    test('valid token returns the right user', async () => {
        const u = await h.registerUser();
        const r = await h.req('GET', '/api/auth/me', undefined, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.user.id, u.user.id);
        assert.equal(r.data.user.password, undefined);
    });
});

describe('PUT /api/users/profile & /password', () => {
    test('updates name and gender', async () => {
        const u = await h.registerUser();
        const r = await h.req('PUT', '/api/users/profile', { name: 'New Name', gender: 'female' }, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.user.name, 'New Name');
        assert.equal(r.data.user.gender, 'female');
    });

    test('rejects a 1-character name', async () => {
        const u = await h.registerUser();
        const r = await h.req('PUT', '/api/users/profile', { name: 'A' }, u.token);
        assert.equal(r.status, 400);
    });

    test('rejects an unknown gender', async () => {
        const u = await h.registerUser();
        const r = await h.req('PUT', '/api/users/profile', { gender: 'robot' }, u.token);
        assert.equal(r.status, 400);
    });

    test('changing password requires the correct current password', async () => {
        const u = await h.registerUser();
        let r = await h.req('PUT', '/api/users/password', { currentPassword: 'nope-nope', newPassword: 'brandnew1' }, u.token);
        assert.equal(r.status, 401);
        r = await h.req('PUT', '/api/users/password', { currentPassword: u.password, newPassword: 'brandnew1' }, u.token);
        assert.equal(r.status, 200);
        r = await h.req('POST', '/api/auth/login', { email: u.email, password: 'brandnew1' });
        assert.equal(r.status, 200, 'can log in with the new password');
    });

    test('GET /api/users/stats works for a brand-new user (no null/NaN counters)', async () => {
        const u = await h.registerUser();
        const r = await h.req('GET', '/api/users/stats', undefined, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.totalSessions, 0);
        assert.equal(r.data.completedSessions, 0, `completedSessions was ${r.data.completedSessions}`);
        assert.equal(r.data.failedSessions, 0, `failedSessions was ${r.data.failedSessions}`);
    });
});
