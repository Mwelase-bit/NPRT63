// server.js — BUILDHAUS Express API Server
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialise database (creates/migrates tables and seeds shop data)
require('./database');

// ─── Import Routes ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const leaderboardRoutes = require('./routes/leaderboard');
const shopRoutes = require('./routes/shop');
const achievementRoutes = require('./routes/achievements');

// ─── Import Middleware ────────────────────────────────────────────────────────
const { sanitiseBody, generalLimiter } = require('./middleware/validate');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors()); // Allow all origins during development
app.use(express.json({ limit: '2mb' }));
app.use(sanitiseBody);       // Trim all incoming string fields
app.use(generalLimiter);     // 60 req/min per IP globally

// Request logger (development)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/achievements', achievementRoutes);

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
            'POST   /api/achievements/unlock'
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
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log('');
    console.log('🏰 BUILDHAUS API Server v2.0');
    console.log('─────────────────────────────────────');
    console.log(`📡 Running at:  http://localhost:${PORT}`);
    console.log(`🔗 Health:      http://localhost:${PORT}/api/health`);
    console.log(`👤 Auth:        http://localhost:${PORT}/api/auth`);
    console.log(`⏱️  Sessions:    http://localhost:${PORT}/api/sessions`);
    console.log(`🏆 Leaderboard: http://localhost:${PORT}/api/leaderboard`);
    console.log(`🛒 Shop:        http://localhost:${PORT}/api/shop`);
    console.log(`🎖️  Achievements: http://localhost:${PORT}/api/achievements`);
    console.log('─────────────────────────────────────');
    console.log('');
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const db = require('./database');

const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        db.close();
        console.log('Database connection closed. Goodbye!');
        process.exit(0);
    });
    // Force exit after 10s if server hasn't closed
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
