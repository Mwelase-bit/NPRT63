// server.js — BUILDHAUS Express API Server
require('dotenv').config({ path: __dirname + '/.env' });

const http = require('http');
const WebSocket = require('ws');

// Initialise database (creates/migrates tables and seeds shop data)
const { pool, initDatabase } = require('./database');

// Express app (all routes + middleware) lives in app.js so it can be tested
const app = require('./app');

const PORT = process.env.PORT || 3001;

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

// Check all clients every 15 seconds.
// Client sends a heartbeat every 4s, so the 11s margin prevents false
// demolitions caused by slow AI API calls or browser event-loop pressure.
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            // Client missed multiple heartbeats — genuine absence detected.
            // Terminates the WS, firing onclose on the client → demolition.
            return ws.terminate();
        }
        ws.isAlive = false; // Reset to false until next pulse
    });
}, 15000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

async function startServer() {
    try {
        await initDatabase();
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
    } catch (err) {
        console.error('Failed to initialize database or start server:', err);
        process.exit(1);
    }
}

startServer();

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    clearInterval(heartbeatInterval);
    server.close(() => {
        pool.end().then(() => {
            console.log('Database connection pool ended. Goodbye!');
            process.exit(0);
        }).catch((err) => {
            console.error('Error ending pool:', err);
            process.exit(1);
        });
    });
    // Force exit after 10s if server hasn't closed
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
