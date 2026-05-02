// server.js — BUILDHAUS Express API Server
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Initialise database (creates/migrates tables and seeds shop data)
require('./database');

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
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';
// app.use(helmet({
//     contentSecurityPolicy: false,
//     crossOriginEmbedderPolicy: false
// }));
app.use(cors()); // Allow all origins (tighten in production if needed)
app.use(express.json({ limit: '2mb' }));
app.use(sanitiseBody);       // Trim all incoming string fields
app.use(generalLimiter);     // 60 req/min per IP globally

// Request logger (development)
if (!isProduction) {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ─── Serve frontend static files ──────────────────────────────────────────────
// In production, the backend serves the frontend so everything runs on one port.
app.use(express.static(path.join(__dirname, '..'), {
    extensions: ['html'],
    index: 'index.html'
}));

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
            'DELETE /api/ai/flashcards/:setId'
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

// ─── Start server ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── WebSocket Server for Heartbeat (FR04, FR05, FR06) ────────────────────────
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.isAlive = true;
    
    // Listen for incoming heartbeat pulses from clients
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'heartbeat') {
                ws.isAlive = true; // Mark as responsive
            }
        } catch (err) {}
    });
});

// Check all clients every 5.5 seconds (allowing 5s interval + slight payload delay)
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            // Client missed 2 continuous heartbeats -> terminate connection!
            // This will instantly fire the `onclose` event on the client, triggering destruction!
            return ws.terminate();
        }
        
        ws.isAlive = false; // Reset to false until next ping
    });
}, 5500);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
    console.log('');
    console.log('🏰 BUILDHAUS/CampusBuilder API & WS Server v2.1');
    console.log('─────────────────────────────────────');
    console.log(`📡 HTTP & WS Running at:  http://localhost:${PORT}`);
    console.log(`🔗 Health:      http://localhost:${PORT}/api/health`);
    console.log(`👤 Auth:        http://localhost:${PORT}/api/auth`);
    console.log(`⏱️  Sessions:    http://localhost:${PORT}/api/sessions`);
    console.log(`🏆 Leaderboard: http://localhost:${PORT}/api/leaderboard`);
    console.log(`🛒 Shop:        http://localhost:${PORT}/api/shop`);
    console.log(`🎖️  Achievements: http://localhost:${PORT}/api/achievements`);
    console.log(`🤖 AI Study:     http://localhost:${PORT}/api/ai/flashcards`);
    console.log('─────────────────────────────────────');
    console.log('');
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const db = require('./database');

const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    clearInterval(heartbeatInterval);
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
