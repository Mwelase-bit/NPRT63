// Validation: AI Study — flashcards, quizzes and quiz-attempt coin rewards.
// The Groq API is mocked in helpers/harness.js; no network calls are made.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/harness');

before(h.start);
after(h.stop);
beforeEach(() => h.groq.reset());

const NOTES = 'Photosynthesis converts light energy into chemical energy stored in glucose inside chloroplasts.';
const CARDS = JSON.stringify([
    { front: 'Where does photosynthesis happen?', back: 'In the chloroplasts.' },
    { front: 'What is produced?', back: 'Glucose (chemical energy).' },
    { front: 'What energy is converted?', back: 'Light energy.' }
]);
const QUIZ = JSON.stringify([
    { question: 'Q1?', options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'Because a.' },
    { question: 'Q2?', options: ['a', 'b', 'c', 'd'], answer: 2, explanation: 'Because c.' },
    { question: 'Q3?', options: ['a', 'b', 'c', 'd'], answer: 1, explanation: 'Because b.' }
]);

async function makeSet(token, extra = {}) {
    h.groq.reply(CARDS);
    const r = await h.req('POST', '/api/ai/flashcards', { text: NOTES, title: 'Bio', subject: 'Biology', cardCount: 3, ...extra }, token);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.setId;
}

describe('POST /api/ai/flashcards', () => {
    test('generates, saves and awards 10 coins', async () => {
        const u = await h.registerUser();
        h.groq.reply('```json\n' + CARDS + '\n```'); // model wraps output in fences
        const r = await h.req('POST', '/api/ai/flashcards', { text: NOTES, title: 'Bio', cardCount: 3 }, u.token);
        assert.equal(r.status, 201);
        assert.equal(r.data.cards.length, 3);
        assert.equal((await h.db.user(u.user.id)).coins, 110);
    });

    test('rejects content shorter than 20 characters and does not call the AI', async () => {
        const u = await h.registerUser();
        const r = await h.req('POST', '/api/ai/flashcards', { text: 'too short' }, u.token);
        assert.equal(r.status, 400);
        assert.equal(h.groq.calls.length, 0);
    });

    test('rejects content over 8000 characters', async () => {
        const u = await h.registerUser();
        const r = await h.req('POST', '/api/ai/flashcards', { text: 'a'.repeat(8001) }, u.token);
        assert.equal(r.status, 400);
    });

    test('non-string title/subject are rejected or coerced — never a 500', async () => {
        const u = await h.registerUser();
        h.groq.reply(CARDS);
        const r = await h.req('POST', '/api/ai/flashcards', { text: NOTES, title: 12345, subject: ['x'] }, u.token);
        assert.ok([201, 400].includes(r.status), `got ${r.status}: ${JSON.stringify(r.data)}`);
    });

    test('card count is clamped to 3..15 in the prompt', async () => {
        const u = await h.registerUser();
        h.groq.reply(CARDS);
        await h.req('POST', '/api/ai/flashcards', { text: NOTES, cardCount: 999 }, u.token);
        assert.match(h.groq.calls[0].messages[1].content, /exactly 15 flashcards/);
    });

    test('malformed AI output → 502 and no coins awarded', async () => {
        const u = await h.registerUser();
        h.groq.reply('Sure! Here are some flashcards: ...');
        const r = await h.req('POST', '/api/ai/flashcards', { text: NOTES }, u.token);
        assert.equal(r.status, 502);
        assert.equal((await h.db.user(u.user.id)).coins, 100);
    });

    test('upstream Groq failure → 502 and the API key / raw upstream body are not leaked', async () => {
        const u = await h.registerUser();
        h.groq.reply({ status: 401, body: '{"error":"invalid api key test-groq-key"}' });
        const r = await h.req('POST', '/api/ai/flashcards', { text: NOTES }, u.token);
        assert.equal(r.status, 502, `got ${r.status}`);
        assert.ok(!JSON.stringify(r.data).includes('test-groq-key'), 'response leaks upstream error body');
    });
});

describe('Flashcard sets — ownership', () => {
    test('list, open and delete your own set', async () => {
        const u = await h.registerUser();
        const id = await makeSet(u.token);
        let r = await h.req('GET', '/api/ai/flashcards', undefined, u.token);
        assert.equal(r.data.sets.length, 1);
        r = await h.req('GET', `/api/ai/flashcards/${id}`, undefined, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.cards.length, 3);
        r = await h.req('DELETE', `/api/ai/flashcards/${id}`, undefined, u.token);
        assert.equal(r.status, 200);
    });

    test("cannot read or delete another user's set", async () => {
        const owner = await h.registerUser();
        const thief = await h.registerUser();
        const id = await makeSet(owner.token);
        assert.equal((await h.req('GET', `/api/ai/flashcards/${id}`, undefined, thief.token)).status, 404);
        assert.equal((await h.req('DELETE', `/api/ai/flashcards/${id}`, undefined, thief.token)).status, 404);
    });

    test('non-numeric set ids → 400/404, not 500', async () => {
        const u = await h.registerUser();
        for (const bad of ['abc', '1.5x', '-1']) {
            const r = await h.req('GET', `/api/ai/flashcards/${bad}`, undefined, u.token);
            assert.ok([400, 404].includes(r.status), `${bad} → ${r.status}`);
        }
    });
});

describe('Quiz generation & attempts', () => {
    test('generates a sanitised quiz from your own set', async () => {
        const u = await h.registerUser();
        const id = await makeSet(u.token);
        h.groq.reply(QUIZ);
        const r = await h.req('POST', '/api/ai/quiz', { setId: id, questionCount: 3 }, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.questions.length, 3);
    });

    test("cannot generate a quiz from someone else's set", async () => {
        const owner = await h.registerUser();
        const other = await h.registerUser();
        const id = await makeSet(owner.token);
        const r = await h.req('POST', '/api/ai/quiz', { setId: id }, other.token);
        assert.equal(r.status, 404);
    });

    test('perfect attempt earns 25 coins', async () => {
        const u = await h.registerUser();
        const id = await makeSet(u.token); // +10 → 110
        const r = await h.req('POST', '/api/ai/quiz/attempt', { setId: id, score: 5, total: 5 }, u.token);
        assert.equal(r.status, 200);
        assert.equal(r.data.coinsEarned, 25);
        assert.equal((await h.db.user(u.user.id)).coins, 135);
    });

    const cheats = [
        ['score greater than total',        { score: 50, total: 5 }],
        ['negative score',                  { score: -1, total: 5 }],
        ['zero total',                      { score: 0, total: 0 }],
        ['huge total',                      { score: 1000, total: 1000 }],
        ['fractional score',                { score: 2.5, total: 5 }],
        ['string numbers',                  { score: '5', total: '5' }],
    ];
    for (const [label, body] of cheats) {
        test(`quiz attempt with ${label} is rejected and pays nothing`, async () => {
            const u = await h.registerUser();
            const id = await makeSet(u.token);
            const r = await h.req('POST', '/api/ai/quiz/attempt', { setId: id, ...body }, u.token);
            assert.equal(r.status, 400, `${label}: got ${r.status} ${JSON.stringify(r.data)}`);
            assert.equal((await h.db.user(u.user.id)).coins, 110);
        });
    }

    test("cannot record an attempt (and earn coins) against another user's set", async () => {
        const owner = await h.registerUser();
        const other = await h.registerUser();
        const id = await makeSet(owner.token);
        const r = await h.req('POST', '/api/ai/quiz/attempt', { setId: id, score: 5, total: 5 }, other.token);
        assert.equal(r.status, 404, `got ${r.status}`);
        assert.equal((await h.db.user(other.user.id)).coins, 100);
    });

    test('attempt against a non-existent set → 404, not a 500 FK error', async () => {
        const u = await h.registerUser();
        const r = await h.req('POST', '/api/ai/quiz/attempt', { setId: 999999, score: 1, total: 5 }, u.token);
        assert.equal(r.status, 404, `got ${r.status}`);
    });
});
