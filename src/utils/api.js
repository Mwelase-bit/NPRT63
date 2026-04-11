// src/utils/api.js — BUILDHAUS Backend API Client
// All methods return Promises and throw on non-2xx responses.
const API_BASE_URL = `http://${window.location.hostname}:3001/api`;

const api = {
    // ── Internal fetch wrapper ─────────────────────────────────────────────────
    async _fetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Attach JWT if available
        const token = localStorage.getItem('buildersFocus_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        let data;
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            const error = new Error(data.error || `HTTP ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    },

    // ── Auth ───────────────────────────────────────────────────────────────────
    auth: {
        register: (userData) =>
            api._fetch('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),

        login: (credentials) =>
            api._fetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

        getMe: () => api._fetch('/auth/me')
    },

    // ── Users ──────────────────────────────────────────────────────────────────
    users: {
        updateProfile: (data) =>
            api._fetch('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),

        changePassword: (data) =>
            api._fetch('/users/password', { method: 'PUT', body: JSON.stringify(data) }),

        getStats: () => api._fetch('/users/stats')
    },

    // ── Sessions ───────────────────────────────────────────────────────────────
    sessions: {
        /**
         * Record a focus session.
         * @param {object} data
         * @param {number} data.duration  - Planned seconds
         * @param {number} data.elapsed   - Actual seconds elapsed
         * @param {boolean} data.completed - Whether session was completed
         */
        create: (data) =>
            api._fetch('/sessions', { method: 'POST', body: JSON.stringify(data) }),

        getHistory: (limit = 20, offset = 0) =>
            api._fetch(`/sessions?limit=${limit}&offset=${offset}`),

        getStats: () => api._fetch('/sessions/stats')
    },

    // ── Leaderboard ────────────────────────────────────────────────────────────
    leaderboard: {
        getFaculty: (facultyId) => {
            const query = facultyId ? `?faculty=${facultyId}` : '';
            return api._fetch(`/leaderboard/faculty${query}`);
        },
        getInterfaculty: () => api._fetch('/leaderboard/interfaculty'),
        getGlobal: () => api._fetch('/leaderboard/global'),
        getSummary: () => api._fetch('/leaderboard/summary')
    },

    // ── Shop ───────────────────────────────────────────────────────────────────
    shop: {
        getAll: () => api._fetch('/shop'),
        getOwned: () => api._fetch('/shop/owned'),
        buy: (itemId) =>
            api._fetch('/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) })
    },

    // ── Achievements ──────────────────────────────────────────────────────────
    achievements: {
        getAll: () => api._fetch('/achievements'),
        unlock: (achievementId) =>
            api._fetch('/achievements/unlock', { method: 'POST', body: JSON.stringify({ achievementId }) })
    }
};

window.api = api;
