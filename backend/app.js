// app.js — BUILDHAUS Express application (routes + middleware, no network I/O)
// Split out of server.js so the validation suite can mount the real app
// against a test database without binding a port or opening a WebSocket.
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const path = require('path');

// ─── Import Routes ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const leaderboardRoutes = require('./routes/leaderboard');
const shopRoutes = require('./routes/shop');
const achievementRoutes = require('./routes/achievements');
const aiRoutes          = require('./routes/ai');

// ─── Import Middleware ────────────────────────────────────────────────────────
const { sanitiseBody, generalLimiter } = require('./middleware/validate');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors()); // Allow all origins (tighten in production if needed)
app.use(express.json({ limit: '2mb' }));
app.use(sanitiseBody);       // Trim all incoming string fields
app.use(generalLimiter);     // 500 req/min per IP globally

// Request logger (development only, silenced under the test runner)
if (!isProduction && process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ─── Serve frontend static files ──────────────────────────────────────────────
// Only the folders the browser actually needs are public. Previously the whole
// project root was served, which exposed backend source, package files, the
// project write-ups and anything else sitting next to index.html.
const ROOT = path.join(__dirname, '..');
app.use('/src',    express.static(path.join(ROOT, 'src')));
app.use('/vendor', express.static(path.join(ROOT, 'vendor')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/ai',           aiRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'BUILDHAUS API is running',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST   /api/auth/register',
            'POST   /api/auth/login',
            'GET    /api/auth/me',
            'PUT    /api/users/profile',
            'PUT    /api/users/password',
            'GET    /api/users/stats',
            'POST   /api/sessions',
            'GET    /api/sessions',
            'GET    /api/sessions/stats',
            'GET    /api/leaderboard/faculty',
            'GET    /api/leaderboard/interfaculty',
            'GET    /api/leaderboard/global',
            'GET    /api/leaderboard/summary',
            'GET    /api/shop',
            'POST   /api/shop/buy',
            'GET    /api/shop/owned',
            'GET    /api/achievements',
            'POST   /api/achievements/unlock',
            'POST   /api/ai/flashcards',
            'GET    /api/ai/flashcards',
            'GET    /api/ai/flashcards/:setId',
            'DELETE /api/ai/flashcards/:setId',
            'POST   /api/ai/quiz',
            'POST   /api/ai/quiz/attempt',
            'GET    /api/ai/quiz/attempts/:setId'
        ]
    });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        error: `Route ${req.method} ${req.path} not found.`,
        hint: 'Check GET /api/health for a list of available endpoints.'
    });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
