// backend/tests/api.test.js — BUILDHAUS API Smoke Tests
// Run with: node backend/tests/api.test.js
// Requires the backend server to be running on port 3001.

const BASE = 'http://localhost:3001/api';
let testToken = '';
let testUserId = null;
const testEmail = `smoketest_${Date.now()}@spu.ac.za`;

// ── Tiny HTTP helper ──────────────────────────────────────────────────────────
async function req(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, data: await r.json() };
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label, extra = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}${extra ? ' — ' + extra : ''}`);
        failed++;
    }
}

// ── Test suites ───────────────────────────────────────────────────────────────

async function testHealth() {
    console.log('\n🔍 Health Check');
    const { status, data } = await req('GET', '/health');
    assert(status === 200, 'GET /health returns 200');
    assert(data.status === 'ok', 'Health status is ok');
    assert(Array.isArray(data.endpoints), 'Endpoints list returned');
}

async function testAuth() {
    console.log('\n👤 Auth — Registration');
    // Missing field
    let r = await req('POST', '/auth/register', { name: 'X', email: testEmail });
    assert(r.status === 400, 'Register missing fields → 400');

    // Invalid faculty
    r = await req('POST', '/auth/register', { name: 'Test', email: testEmail, password: 'pass123', faculty: 'bad' });
    assert(r.status === 400, 'Register invalid faculty → 400');

    // Valid registration
    r = await req('POST', '/auth/register', { name: 'Smoke Tester', email: testEmail, password: 'pass123', faculty: 'nas' });
    assert(r.status === 201, 'Register valid user → 201');
    assert(r.data.token, 'Registration returns JWT token');
    testToken = r.data.token;
    testUserId = r.data.user?.id;

    // Duplicate email
    r = await req('POST', '/auth/register', { name: 'Dup', email: testEmail, password: 'pass123', faculty: 'edu' });
    assert(r.status === 409, 'Register duplicate email → 409');

    console.log('\n👤 Auth — Login');
    r = await req('POST', '/auth/login', { email: testEmail, password: 'wrongpass' });
    assert(r.status === 401, 'Login wrong password → 401');

    r = await req('POST', '/auth/login', { email: testEmail, password: 'pass123' });
    assert(r.status === 200, 'Login valid credentials → 200');
    assert(r.data.token, 'Login returns JWT token');

    console.log('\n👤 Auth — Me');
    r = await req('GET', '/auth/me', null, testToken);
    assert(r.status === 200, 'GET /auth/me returns 200');
    assert(r.data.user?.email === testEmail, 'Me returns correct user');
}

async function testSessions() {
    console.log('\n⏱️  Sessions');

    let r = await req('POST', '/sessions', { duration: 1500, elapsed: 1500, completed: true }, testToken);
    assert(r.status === 201, 'POST session completed → 201');
    assert(r.data.coinsEarned >= 25, 'Completed session earns coins (≥25 for 25min)');

    r = await req('POST', '/sessions', { duration: 1500, elapsed: 300, completed: false }, testToken);
    assert(r.status === 201, 'POST session interrupted → 201');
    assert(r.data.coinsEarned === 0, 'Interrupted session earns 0 coins');

    r = await req('GET', '/sessions', null, testToken);
    assert(r.status === 200, 'GET /sessions returns 200');
    assert(r.data.sessions?.length >= 2, 'Session history lists recorded sessions');

    r = await req('GET', '/sessions/stats', null, testToken);
    assert(r.status === 200, 'GET /sessions/stats returns 200');
    assert(r.data.completedSessions === 1, 'Stats reports 1 completed session');
    assert(r.data.failedSessions === 1, 'Stats reports 1 failed session');
}

async function testShop() {
    console.log('\n🛒 Shop');

    let r = await req('GET', '/shop', null, testToken);
    assert(r.status === 200, 'GET /shop returns 200');
    assert(r.data.categories?.outfit, 'Shop has outfit category');
    assert(r.data.categories?.hat, 'Shop has hat category');
    assert(r.data.categories?.house, 'Shop has house category');

    // Buy an item
    r = await req('POST', '/shop/buy', { itemId: 'hat_beanie' }, testToken);
    assert(r.status === 201, 'POST /shop/buy returns 201');
    assert(r.data.coinsRemaining !== undefined, 'Returns remaining coins');

    // Buy again — should fail
    r = await req('POST', '/shop/buy', { itemId: 'hat_beanie' }, testToken);
    assert(r.status === 409, 'Buying already-owned item → 409');

    // Not enough coins
    r = await req('POST', '/shop/buy', { itemId: 'house_palace' }, testToken);
    assert(r.status === 402, 'Buying too-expensive item → 402');

    r = await req('GET', '/shop/owned', null, testToken);
    assert(r.status === 200, 'GET /shop/owned returns 200');
    assert(r.data.owned?.length >= 1, 'Owned items list populated');
}

async function testLeaderboards() {
    console.log('\n🏆 Leaderboard');

    let r = await req('GET', '/leaderboard/faculty', null, testToken);
    assert(r.status === 200, 'GET /leaderboard/faculty returns 200');
    assert(r.data.faculty === 'nas', 'Faculty leaderboard is for user faculty');
    assert(Array.isArray(r.data.leaderboard), 'Leaderboard is an array');

    r = await req('GET', '/leaderboard/interfaculty', null, testToken);
    assert(r.status === 200, 'GET /leaderboard/interfaculty returns 200');
    assert(Array.isArray(r.data.rankings), 'Interfaculty rankings is an array');

    r = await req('GET', '/leaderboard/global', null, testToken);
    assert(r.status === 200, 'GET /leaderboard/global returns 200');
    assert(Array.isArray(r.data.leaderboard), 'Global leaderboard is an array');
}

async function testAchievements() {
    console.log('\n🎖️  Achievements');

    let r = await req('POST', '/achievements/unlock', { achievementId: 'first_session' }, testToken);
    assert(r.status === 201, 'POST /achievements/unlock → 201');

    // Idempotent — second call should succeed but report already unlocked
    r = await req('POST', '/achievements/unlock', { achievementId: 'first_session' }, testToken);
    assert(r.status === 200 && r.data.alreadyUnlocked, 'Duplicate unlock is idempotent → 200');

    r = await req('GET', '/achievements', null, testToken);
    assert(r.status === 200, 'GET /achievements returns 200');
    assert(r.data.achievements?.length >= 1, 'Achievements list populated');
}

async function testUsers() {
    console.log('\n🧑 Users');

    let r = await req('PUT', '/users/profile', { name: 'Updated Name', gender: 'male' }, testToken);
    assert(r.status === 200, 'PUT /users/profile returns 200');
    assert(r.data.user?.name === 'Updated Name', 'Name updated correctly');

    r = await req('GET', '/users/stats', null, testToken);
    assert(r.status === 200, 'GET /users/stats returns 200');
    assert('coins' in r.data, 'Stats includes coins');
    assert('streak' in r.data, 'Stats includes streak');
    assert('successRate' in r.data, 'Stats includes successRate');
}

async function testSecurity() {
    console.log('\n🔒 Security');

    // Protected routes without token
    const protectedRoutes = [
        ['GET', '/auth/me'],
        ['GET', '/sessions'],
        ['GET', '/shop'],
        ['GET', '/leaderboard/global'],
        ['GET', '/achievements'],
    ];

    for (const [method, path] of protectedRoutes) {
        const r = await req(method, path);
        assert(r.status === 401, `${method} ${path} without token → 401`);
    }
}

// ── Run all tests ─────────────────────────────────────────────────────────────
(async () => {
    console.log('═══════════════════════════════════════════');
    console.log('  BUILDHAUS API — Smoke Test Suite');
    console.log('═══════════════════════════════════════════');

    try {
        await testHealth();
        await testAuth();
        await testSessions();
        await testShop();
        await testLeaderboards();
        await testAchievements();
        await testUsers();
        await testSecurity();
    } catch (err) {
        console.error('\n💥 Fatal test error:', err.message);
        failed++;
    }

    console.log('\n═══════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
})();
