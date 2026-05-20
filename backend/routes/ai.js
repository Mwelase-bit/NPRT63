// routes/ai.js — AI Study features powered by Groq (LLaMA 3)
// Includes: flashcard generation, quiz generation, quiz attempt recording
const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { authenticate } = require('../middleware/auth');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// Coins awarded per flashcard set generated (game integration)
const COINS_PER_SET = 10;

// Quiz coin rewards based on score percentage
const QUIZ_COINS = { perfect: 25, great: 15, good: 10, pass: 5 };

// ─── Helper: call Groq API ────────────────────────────────────────────────────
async function callGroq(systemPrompt, userContent, maxTokens = 2048) {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured on the server.');
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userContent  }
            ],
            max_tokens: maxTokens,
            temperature: 0.4   // Low temperature = consistent, factual output
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// ─── POST /api/ai/flashcards — Generate & save a flashcard set ────────────────
router.post('/flashcards', authenticate, async (req, res) => {
    try {
        const { text, title, subject, cardCount = 8 } = req.body;
        const userId = req.user.id;

        // Validate
        if (!text || typeof text !== 'string' || text.trim().length < 20) {
            return res.status(400).json({ error: 'Please provide at least 20 characters of study content.' });
        }
        if (text.length > 8000) {
            return res.status(400).json({ error: 'Content too long. Please limit to 8000 characters.' });
        }
        const safeCount = Math.min(Math.max(parseInt(cardCount) || 8, 3), 15);
        const safeTitle   = (title   || 'My Flashcard Set').slice(0, 100);
        const safeSubject = (subject || 'General').slice(0, 50);

        // Build the AI prompt — strict JSON output so we can parse it reliably
        const systemPrompt = `You are an expert academic tutor who creates concise, clear flashcards for university students.
When given study content, you MUST respond with ONLY a valid JSON array — no markdown, no explanation, no code fences.
Each object in the array must have exactly two keys: "front" (a question) and "back" (a concise answer, max 2 sentences).
Make the questions test genuine understanding, not just memorisation of exact words.`;

        const userMessage = `Create exactly ${safeCount} flashcards from the following study content.
Respond with ONLY the JSON array.

--- CONTENT START ---
${text.trim()}
--- CONTENT END ---`;

        const rawResponse = await callGroq(systemPrompt, userMessage, 2048);

        // Parse the JSON response from the AI
        let cards;
        try {
            // Strip any accidental markdown fences the model might add
            const cleaned = rawResponse.replace(/```json|```/gi, '').trim();
            cards = JSON.parse(cleaned);
            if (!Array.isArray(cards)) throw new Error('Not an array');
        } catch (parseErr) {
            console.error('Groq parse error. Raw response:', rawResponse);
            return res.status(502).json({
                error: 'The AI returned an unexpected format. Please try again.',
                detail: parseErr.message
            });
        }

        // Sanitise cards
        const cleanCards = cards
            .filter(c => c && typeof c.front === 'string' && typeof c.back === 'string')
            .slice(0, safeCount)
            .map((c, i) => ({
                front: c.front.trim().slice(0, 300),
                back:  c.back.trim().slice(0, 500),
                position: i
            }));

        if (cleanCards.length === 0) {
            return res.status(502).json({ error: 'AI did not return any usable flashcards. Please try again.' });
        }

        // ── Persist to database ──────────────────────────────────────────────
        const saveSet = db.transaction(() => {
            const setRow = db.prepare(`
                INSERT INTO flashcard_sets (user_id, title, subject, source_text, card_count, coins_earned)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, safeTitle, safeSubject, text.trim().slice(0, 8000), cleanCards.length, COINS_PER_SET);

            const setId = setRow.lastInsertRowid;

            const insertCard = db.prepare(`
                INSERT INTO flashcards (set_id, user_id, front, back, position)
                VALUES (?, ?, ?, ?, ?)
            `);
            for (const card of cleanCards) {
                insertCard.run(setId, userId, card.front, card.back, card.position);
            }

            // Award coins for generating the set (game integration)
            db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(COINS_PER_SET, userId);

            return setId;
        });

        const newSetId = saveSet();

        res.status(201).json({
            message: `Generated ${cleanCards.length} flashcards! +${COINS_PER_SET} coins earned. 🎴`,
            setId:   newSetId,
            coinsEarned: COINS_PER_SET,
            cards:   cleanCards
        });

    } catch (err) {
        console.error('AI flashcard error:', err);
        res.status(500).json({ error: err.message || 'Server error generating flashcards.' });
    }
});

// ─── GET /api/ai/flashcards — List all saved sets for this user ───────────────
router.get('/flashcards', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const sets = db.prepare(`
            SELECT id, title, subject, card_count, coins_earned, created_at
            FROM flashcard_sets
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `).all(userId);

        res.json({
            sets: sets.map(s => ({
                id:         s.id,
                title:      s.title,
                subject:    s.subject,
                cardCount:  s.card_count,
                coinsEarned: s.coins_earned,
                createdAt:  s.created_at
            }))
        });
    } catch (err) {
        console.error('Fetch sets error:', err);
        res.status(500).json({ error: 'Server error fetching flashcard sets.' });
    }
});

// ─── GET /api/ai/flashcards/:setId — Get cards in a specific set ─────────────
router.get('/flashcards/:setId', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const setId  = parseInt(req.params.setId);

        const set = db.prepare(`
            SELECT id, title, subject, card_count, coins_earned, created_at
            FROM flashcard_sets WHERE id = ? AND user_id = ?
        `).get(setId, userId);

        if (!set) return res.status(404).json({ error: 'Flashcard set not found.' });

        const cards = db.prepare(`
            SELECT id, front, back, position
            FROM flashcards WHERE set_id = ? ORDER BY position ASC
        `).all(setId);

        res.json({
            set: {
                id:         set.id,
                title:      set.title,
                subject:    set.subject,
                cardCount:  set.card_count,
                coinsEarned: set.coins_earned,
                createdAt:  set.created_at
            },
            cards: cards.map(c => ({ id: c.id, front: c.front, back: c.back, position: c.position }))
        });
    } catch (err) {
        console.error('Fetch set cards error:', err);
        res.status(500).json({ error: 'Server error fetching cards.' });
    }
});

// ─── DELETE /api/ai/flashcards/:setId — Delete a set ─────────────────────────
router.delete('/flashcards/:setId', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const setId  = parseInt(req.params.setId);

        const result = db.prepare(
            'DELETE FROM flashcard_sets WHERE id = ? AND user_id = ?'
        ).run(setId, userId);

        if (result.changes === 0) return res.status(404).json({ error: 'Set not found.' });

        res.json({ message: 'Flashcard set deleted.' });
    } catch (err) {
        console.error('Delete set error:', err);
        res.status(500).json({ error: 'Server error deleting set.' });
    }
});

// ─── POST /api/ai/quiz — Generate MCQ quiz from a flashcard set ───────────────
router.post('/quiz', authenticate, async (req, res) => {
    try {
        const { setId, questionCount = 5 } = req.body;
        const userId = req.user.id;

        if (!setId) return res.status(400).json({ error: 'setId is required.' });

        // Load the source text for the set
        const set = db.prepare(
            'SELECT id, title, subject, source_text FROM flashcard_sets WHERE id = ? AND user_id = ?'
        ).get(setId, userId);

        if (!set) return res.status(404).json({ error: 'Flashcard set not found.' });
        if (!set.source_text || set.source_text.trim().length < 20) {
            return res.status(400).json({ error: 'This set has no source text to generate a quiz from.' });
        }

        const safeCount = Math.min(Math.max(parseInt(questionCount) || 5, 3), 10);

        const systemPrompt = `You are an expert academic quiz creator for university students.
Given study content, create multiple-choice questions with exactly 4 options each.
You MUST respond with ONLY a valid JSON array — no markdown, no explanation, no code fences.
Each object must have exactly these keys:
- "question": the question text (string)
- "options": array of exactly 4 strings (the answer choices)
- "answer": the index (0-3) of the correct option
- "explanation": a brief explanation of why the answer is correct (1-2 sentences)
Make sure distractors (wrong answers) are plausible but clearly incorrect to a student who knows the material.`;

        const userMessage = `Create exactly ${safeCount} multiple-choice questions from the following study content.
Respond with ONLY the JSON array.

--- CONTENT START ---
${set.source_text.trim()}
--- CONTENT END ---`;

        const rawResponse = await callGroq(systemPrompt, userMessage, 3000);

        let questions;
        try {
            const cleaned = rawResponse.replace(/```json|```/gi, '').trim();
            questions = JSON.parse(cleaned);
            if (!Array.isArray(questions)) throw new Error('Not an array');
        } catch (parseErr) {
            console.error('Quiz parse error. Raw:', rawResponse);
            return res.status(502).json({
                error: 'The AI returned an unexpected format. Please try again.',
                detail: parseErr.message
            });
        }

        // Sanitise questions
        const cleanQuestions = questions
            .filter(q =>
                q &&
                typeof q.question === 'string' &&
                Array.isArray(q.options) && q.options.length === 4 &&
                typeof q.answer === 'number' && q.answer >= 0 && q.answer <= 3 &&
                typeof q.explanation === 'string'
            )
            .slice(0, safeCount)
            .map((q, i) => ({
                id: i,
                question:    q.question.trim().slice(0, 400),
                options:     q.options.map(o => String(o).trim().slice(0, 200)),
                answer:      q.answer,
                explanation: q.explanation.trim().slice(0, 400)
            }));

        if (cleanQuestions.length === 0) {
            return res.status(502).json({ error: 'AI did not return any usable questions. Please try again.' });
        }

        res.json({
            setId: set.id,
            setTitle: set.title,
            subject: set.subject,
            questions: cleanQuestions
        });

    } catch (err) {
        console.error('AI quiz error:', err);
        res.status(500).json({ error: err.message || 'Server error generating quiz.' });
    }
});

// ─── POST /api/ai/quiz/attempt — Save a quiz result & award coins ─────────────
router.post('/quiz/attempt', authenticate, async (req, res) => {
    try {
        const { setId, score, total } = req.body;
        const userId = req.user.id;

        if (setId === undefined || score === undefined || total === undefined) {
            return res.status(400).json({ error: 'setId, score, and total are required.' });
        }

        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        let coinsEarned = 0;
        if (pct === 100)      coinsEarned = QUIZ_COINS.perfect;
        else if (pct >= 80)   coinsEarned = QUIZ_COINS.great;
        else if (pct >= 60)   coinsEarned = QUIZ_COINS.good;
        else if (pct >= 40)   coinsEarned = QUIZ_COINS.pass;

        // Persist attempt
        db.prepare(`
            INSERT INTO quiz_attempts (user_id, set_id, score, total, coins_earned)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, setId, score, total, coinsEarned);

        // Award coins
        if (coinsEarned > 0) {
            db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coinsEarned, userId);
        }

        res.json({
            message: coinsEarned > 0
                ? `Quiz complete! You scored ${pct}% and earned +${coinsEarned} coins!`
                : `Quiz complete! You scored ${pct}%. Keep practising!`,
            coinsEarned,
            percentage: pct
        });

    } catch (err) {
        console.error('Quiz attempt error:', err);
        res.status(500).json({ error: err.message || 'Server error saving quiz attempt.' });
    }
});

// ─── GET /api/ai/quiz/attempts/:setId — Get quiz history for a set ────────────
router.get('/quiz/attempts/:setId', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const setId  = parseInt(req.params.setId);

        const attempts = db.prepare(`
            SELECT score, total, coins_earned, taken_at
            FROM quiz_attempts
            WHERE user_id = ? AND set_id = ?
            ORDER BY taken_at DESC
            LIMIT 10
        `).all(userId, setId);

        res.json({ attempts });
    } catch (err) {
        console.error('Quiz attempts error:', err);
        res.status(500).json({ error: 'Server error fetching quiz attempts.' });
    }
});

module.exports = router;
