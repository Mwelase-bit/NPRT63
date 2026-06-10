// routes/leaderboard.js — Faculty, interfaculty, and global leaderboards
const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');

const FACULTY_NAMES = {
    nas: 'Faculty of Natural and Applied Sciences',
    edu: 'Faculty of Education',
    ems: 'Faculty of Economic and Management Sciences',
    hum: 'Faculty of Humanities'
};

const FACULTY_EMOJIS  = { nas: '🔬', edu: '📚', ems: '📊', hum: '🎨' };
const FACULTY_COLORS  = { nas: '#2196F3', edu: '#4CAF50', ems: '#FF9800', hum: '#9C27B0' };

// ─── GET /api/leaderboard/faculty — Rankings within the user's faculty ─────────
router.get('/faculty', authenticate, async (req, res) => {
    try {
        const faculty = req.query.faculty || req.user.faculty;

        const result = await pool.query(`
            SELECT
                u.id,
                u.name,
                u.faculty,
                u.streak,
                u.houses_built,
                COALESCE(SUM(CASE WHEN s.completed THEN s.elapsed ELSE 0 END), 0) AS weekly_seconds,
                COUNT(CASE WHEN s.completed THEN 1 END)                            AS sessions_completed
            FROM users u
            LEFT JOIN focus_sessions s
                ON s.user_id = u.id
               AND s.created_at::date >= (CURRENT_DATE - INTERVAL '7 days')
            WHERE u.faculty = $1
            GROUP BY u.id
            ORDER BY weekly_seconds DESC
        `, [faculty]);

        res.json({
            faculty,
            facultyName:  FACULTY_NAMES[faculty]  || faculty,
            facultyEmoji: FACULTY_EMOJIS[faculty]  || '🏫',
            facultyColor: FACULTY_COLORS[faculty]  || '#888',
            leaderboard: result.rows.map((m, i) => ({
                rank:              i + 1,
                id:                m.id,
                name:              m.name,
                weeklyHours:       parseFloat((parseInt(m.weekly_seconds, 10) / 3600).toFixed(1)),
                streak:            m.streak,
                housesBuilt:       m.houses_built,
                sessionsCompleted: parseInt(m.sessions_completed, 10),
                isCurrentUser:     m.id === req.user.id
            }))
        });
    } catch (err) {
        console.error('Faculty leaderboard error:', err);
        res.status(500).json({ error: 'Server error fetching faculty leaderboard.' });
    }
});

// ─── GET /api/leaderboard/interfaculty — Campus-wide faculty rankings ──────────
router.get('/interfaculty', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.faculty,
                COUNT(DISTINCT u.id)                                                AS student_count,
                COALESCE(SUM(CASE WHEN s.completed THEN s.elapsed ELSE 0 END), 0)  AS total_seconds
            FROM users u
            LEFT JOIN focus_sessions s
                ON s.user_id = u.id
               AND s.created_at::date >= (CURRENT_DATE - INTERVAL '7 days')
            GROUP BY u.faculty
            ORDER BY total_seconds DESC
        `);

        res.json({
            userFaculty: req.user.faculty,
            rankings: result.rows.map((r, i) => ({
                rank:         i + 1,
                faculty:      r.faculty,
                facultyName:  FACULTY_NAMES[r.faculty]  || r.faculty,
                facultyEmoji: FACULTY_EMOJIS[r.faculty]  || '🏫',
                facultyColor: FACULTY_COLORS[r.faculty]  || '#888',
                totalHours:   parseFloat((parseInt(r.total_seconds, 10) / 3600).toFixed(1)),
                studentCount: parseInt(r.student_count, 10),
                isUserFaculty: r.faculty === req.user.faculty
            }))
        });
    } catch (err) {
        console.error('Interfaculty leaderboard error:', err);
        res.status(500).json({ error: 'Server error fetching interfaculty rankings.' });
    }
});

// ─── GET /api/leaderboard/global — Top 50 users by all-time focus hours ────────
router.get('/global', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, faculty, streak, houses_built, total_focus_sec
            FROM users
            ORDER BY total_focus_sec DESC
            LIMIT 50
        `);

        res.json({
            leaderboard: result.rows.map((u, i) => ({
                rank:          i + 1,
                id:            u.id,
                name:          u.name,
                faculty:       u.faculty,
                facultyName:   FACULTY_NAMES[u.faculty] || u.faculty,
                totalHours:    parseFloat((u.total_focus_sec / 3600).toFixed(1)),
                streak:        u.streak,
                housesBuilt:   u.houses_built,
                isCurrentUser: u.id === req.user.id
            }))
        });
    } catch (err) {
        console.error('Global leaderboard error:', err);
        res.status(500).json({ error: 'Server error fetching global leaderboard.' });
    }
});

// ─── GET /api/leaderboard/summary — Platform-wide totals ──────────────────────
router.get('/summary', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(id)                         AS total_users,
                COALESCE(SUM(total_focus_sec), 0) AS total_seconds,
                COALESCE(SUM(houses_built), 0)    AS total_houses,
                COALESCE(AVG(streak), 0)          AS avg_streak
            FROM users
        `);

        const s = result.rows[0];
        res.json({
            totalMembers: parseInt(s.total_users, 10),
            totalHours:   Math.round(parseInt(s.total_seconds, 10) / 3600),
            totalHouses:  parseInt(s.total_houses, 10),
            averageStreak: parseFloat(s.avg_streak).toFixed(1)
        });
    } catch (err) {
        console.error('Summary stats error:', err);
        res.status(500).json({ error: 'Server error fetching summary stats.' });
    }
});

module.exports = router;
