// routes/leaderboard.js — Faculty, interfaculty, and global leaderboards
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');

const FACULTY_NAMES = {
    nas: 'Faculty of Natural and Applied Sciences',
    edu: 'Faculty of Education',
    ems: 'Faculty of Economic and Management Sciences',
    hum: 'Faculty of Humanities'
};

const FACULTY_EMOJIS = {
    nas: '🔬', edu: '📚', ems: '📊', hum: '🎨'
};

const FACULTY_COLORS = {
    nas: '#2196F3', edu: '#4CAF50', ems: '#FF9800', hum: '#9C27B0'
};

// Shared weekly window (last 7 days)
const weekAgoDate = () => new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];

// ─── GET /api/leaderboard/faculty — Rankings within the user's faculty ────────
router.get('/faculty', authenticate, (req, res) => {
    try {
        const faculty = req.query.faculty || req.user.faculty;
        const weekAgo = weekAgoDate();

        const members = db.prepare(`
            SELECT
                u.id,
                u.name,
                u.faculty,
                u.streak,
                u.houses_built,
                COALESCE(SUM(CASE WHEN s.completed = 1 THEN s.elapsed ELSE 0 END), 0) AS weekly_seconds,
                COUNT(CASE WHEN s.completed = 1 THEN 1 END)                            AS sessions_completed
            FROM users u
            LEFT JOIN focus_sessions s
                ON s.user_id = u.id AND date(s.created_at) >= ?
            WHERE u.faculty = ?
            GROUP BY u.id
            ORDER BY weekly_seconds DESC
        `).all(weekAgo, faculty);

        res.json({
            faculty,
            facultyName: FACULTY_NAMES[faculty] || faculty,
            facultyEmoji: FACULTY_EMOJIS[faculty] || '🏫',
            facultyColor: FACULTY_COLORS[faculty] || '#888',
            leaderboard: members.map((m, i) => ({
                rank: i + 1,
                id: m.id,
                name: m.name,
                weeklyHours: parseFloat((m.weekly_seconds / 3600).toFixed(1)),
                streak: m.streak,
                housesBuilt: m.houses_built,
                sessionsCompleted: m.sessions_completed,
                isCurrentUser: m.id === req.user.id
            }))
        });
    } catch (err) {
        console.error('Faculty leaderboard error:', err);
        res.status(500).json({ error: 'Server error fetching faculty leaderboard.' });
    }
});

// ─── GET /api/leaderboard/interfaculty — Campus-wide faculty rankings ─────────
router.get('/interfaculty', authenticate, (req, res) => {
    try {
        const weekAgo = weekAgoDate();

        const results = db.prepare(`
            SELECT
                u.faculty,
                COUNT(DISTINCT u.id)                                                    AS student_count,
                COALESCE(SUM(CASE WHEN s.completed = 1 THEN s.elapsed ELSE 0 END), 0)  AS total_seconds
            FROM users u
            LEFT JOIN focus_sessions s
                ON s.user_id = u.id AND date(s.created_at) >= ?
            GROUP BY u.faculty
            ORDER BY total_seconds DESC
        `).all(weekAgo);

        res.json({
            userFaculty: req.user.faculty,
            rankings: results.map((r, i) => ({
                rank: i + 1,
                faculty: r.faculty,
                facultyName: FACULTY_NAMES[r.faculty] || r.faculty,
                facultyEmoji: FACULTY_EMOJIS[r.faculty] || '🏫',
                facultyColor: FACULTY_COLORS[r.faculty] || '#888',
                totalHours: parseFloat((r.total_seconds / 3600).toFixed(1)),
                studentCount: r.student_count,
                isUserFaculty: r.faculty === req.user.faculty
            }))
        });
    } catch (err) {
        console.error('Interfaculty leaderboard error:', err);
        res.status(500).json({ error: 'Server error fetching interfaculty rankings.' });
    }
});

// ─── GET /api/leaderboard/global — Top 50 users by all-time focus hours ───────
router.get('/global', authenticate, (req, res) => {
    try {
        const top = db.prepare(`
            SELECT
                u.id,
                u.name,
                u.faculty,
                u.streak,
                u.houses_built,
                u.total_focus_sec
            FROM users u
            ORDER BY u.total_focus_sec DESC
            LIMIT 50
        `).all();

        res.json({
            leaderboard: top.map((u, i) => ({
                rank: i + 1,
                id: u.id,
                name: u.name,
                faculty: u.faculty,
                facultyName: FACULTY_NAMES[u.faculty] || u.faculty,
                totalHours: parseFloat((u.total_focus_sec / 3600).toFixed(1)),
                streak: u.streak,
                housesBuilt: u.houses_built,
                isCurrentUser: u.id === req.user.id
            }))
        });
    } catch (err) {
        console.error('Global leaderboard error:', err);
        res.status(500).json({ error: 'Server error fetching global leaderboard.' });
    }
});

// ─── GET /api/leaderboard/summary — Platform wide totals ──────────────────────
router.get('/summary', authenticate, (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT
                COUNT(id) AS total_users,
                COALESCE(SUM(total_focus_sec), 0) AS total_seconds,
                COALESCE(SUM(houses_built), 0) AS total_houses,
                COALESCE(AVG(streak), 0) AS avg_streak
            FROM users
        `).get();

        res.json({
            totalMembers: stats.total_users,
            totalHours: Math.round(stats.total_seconds / 3600),
            totalHouses: stats.total_houses,
            averageStreak: stats.avg_streak.toFixed(1)
        });
    } catch (err) {
        console.error('Summary stats error:', err);
        res.status(500).json({ error: 'Server error fetching summary stats.' });
    }
});

module.exports = router;
