// src/utils/api.js — BUILDHAUS Backend API Client
// All methods return Promises and throw on non-2xx responses.
// Auto-detect: in production the backend serves the frontend on the same origin.
// In development, connect to the local backend on port 3001.
const API_BASE_URL = (window.location.port === '3001' || window.location.port === '')
    ? '/api'
    : `http://${window.location.hostname}:3001/api`;

const api = {
    // ── Internal fetch wrapper ─────────────────────────────────────────────────
    async _fetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
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

        getStats: () => api._fetch('/users/stats'),

        // The saved character look, and which shop items the student owns
        getAvatar: () => api._fetch('/users/avatar'),
        saveAvatar: (fields) => api._fetch('/users/avatar', { method: 'PUT', body: JSON.stringify(fields) })
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

        // Tells friends a session has begun (best effort; the app never waits on it)
        start: (duration) =>
            api._fetch('/sessions/start', { method: 'POST', body: JSON.stringify({ duration }) }),

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

    // ── Rewards: bonuses are checked and paid by the server ─────────────────────
    rewards: {
        status: () => api._fetch('/rewards/status'),
        claim: (kind) => api._fetch('/rewards/claim', { method: 'POST', body: JSON.stringify({ kind }) })
    },

    // ── Notifications: list, switches and Web Push subscriptions ───────────────
    notifications: {
        list: () => api._fetch('/notifications'),
        markRead: (ids) => api._fetch('/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }),
        markAllRead: () => api._fetch('/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) }),
        clear: () => api._fetch('/notifications', { method: 'DELETE' }),
        prefs: () => api._fetch('/notifications/prefs'),
        setPref: (category, enabled) => api._fetch('/notifications/prefs', { method: 'PUT', body: JSON.stringify({ category, enabled }) }),
        pushKey: () => api._fetch('/notifications/push/key'),
        subscribe: (subscription) => api._fetch('/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
        unsubscribe: (endpoint) => api._fetch('/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) })
    },

    // ── Social: friends, class groups, shared study rooms ─────────────────────
    social: {
        me: () => api._fetch('/social/me'),
        invite: (code) => api._fetch(`/social/invite/${encodeURIComponent(code)}`),
        // friends
        friends: () => api._fetch('/social/friends'),
        requestFriend: (code) => api._fetch('/social/friends/request', { method: 'POST', body: JSON.stringify({ code }) }),
        acceptFriend: (id) => api._fetch(`/social/friends/${id}/accept`, { method: 'POST', body: '{}' }),
        declineFriend: (id) => api._fetch(`/social/friends/${id}/decline`, { method: 'POST', body: '{}' }),
        removeFriend: (id) => api._fetch(`/social/friends/${id}`, { method: 'DELETE' }),
        // groups
        groups: () => api._fetch('/social/groups'),
        group: (id) => api._fetch(`/social/groups/${id}`),
        createGroup: (name) => api._fetch('/social/groups', { method: 'POST', body: JSON.stringify({ name }) }),
        joinGroup: (code) => api._fetch('/social/groups/join', { method: 'POST', body: JSON.stringify({ code }) }),
        leaveGroup: (id) => api._fetch(`/social/groups/${id}/leave`, { method: 'POST', body: '{}' }),
        resetGroupCode: (id) => api._fetch(`/social/groups/${id}/regenerate-code`, { method: 'POST', body: '{}' }),
        removeGroupMember: (id, userId) => api._fetch(`/social/groups/${id}/members/${userId}`, { method: 'DELETE' }),
        deleteGroup: (id) => api._fetch(`/social/groups/${id}`, { method: 'DELETE' }),
        // study rooms
        rooms: () => api._fetch('/social/rooms'),
        room: (id) => api._fetch(`/social/rooms/${id}`),
        createRoom: (body) => api._fetch('/social/rooms', { method: 'POST', body: JSON.stringify(body) }),
        joinRoom: (code) => api._fetch('/social/rooms/join', { method: 'POST', body: JSON.stringify({ code }) }),
        joinRoomById: (id) => api._fetch(`/social/rooms/${id}/join`, { method: 'POST', body: '{}' }),
        roomStatus: (id, status) => api._fetch(`/social/rooms/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
        leaveRoom: (id) => api._fetch(`/social/rooms/${id}/leave`, { method: 'POST', body: '{}' }),
        closeRoom: (id) => api._fetch(`/social/rooms/${id}/close`, { method: 'POST', body: '{}' })
    },

    // ── Analytics ─────────────────────────────────────────────────────────────
    analytics: {
        get: ({ from, to, tz } = {}) => {
            const q = new URLSearchParams();
            if (from) q.set('from', from);
            if (to) q.set('to', to);
            if (tz) q.set('tz', tz);
            return api._fetch(`/analytics?${q.toString()}`);
        },
        heartbeat: (seconds) =>
            api._fetch('/analytics/heartbeat', { method: 'POST', body: JSON.stringify({ seconds }) }),
        visit: () =>
            api._fetch('/analytics/visit', { method: 'POST', body: JSON.stringify({}) })
    },

    // ── Achievements ──────────────────────────────────────────────────────────
    achievements: {
        getAll: () => api._fetch('/achievements'),
        unlock: (achievementId) =>
            api._fetch('/achievements/unlock', { method: 'POST', body: JSON.stringify({ achievementId }) })
    }
};

window.api = api;

// Expose base URL so other components (e.g. StudyPanel) can point to the correct backend
window.API_BASE = API_BASE_URL.replace('/api', '');
