// src/utils/notifications.js — BUILDHAUS Browser Notifications
// Handles streak reminders, session completion alerts, and permission management.

const NotificationManager = (() => {
    let permission = 'default';
    let reminderTimerId = null;

    const init = async () => {
        if (!('Notification' in window)) {
            console.warn('Browser notifications not supported');
            return false;
        }
        permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        return permission === 'granted';
    };

    const send = (title, options = {}) => {
        if (permission !== 'granted') return null;
        try {
            const notif = new Notification(title, {
                icon: '🏰',
                badge: '🏰',
                ...options,
            });
            // Auto-close after 6 seconds
            setTimeout(() => notif.close(), 6000);
            return notif;
        } catch (e) {
            console.warn('Notification failed:', e);
            return null;
        }
    };

    return {
        // Request permission (call early, e.g. after registration)
        async requestPermission() {
            return init();
        },

        isSupported() {
            return 'Notification' in window;
        },

        isGranted() {
            return Notification.permission === 'granted';
        },

        // ── Session Notifications ──────────────────────
        sessionComplete(duration) {
            const mins = Math.round(duration / 60);
            send('🎉 Focus Session Complete!', {
                body: `Amazing! You stayed focused for ${mins} minutes. Your building is complete!`,
                tag: 'session-complete',
            });
        },

        sessionInterrupted() {
            send('💥 Session Interrupted', {
                body: 'Your building was demolished. Stay focused next time!',
                tag: 'session-interrupted',
            });
        },

        // ── Streak Notifications ───────────────────────
        streakReminder(currentStreak) {
            send('🔥 Don\'t break your streak!', {
                body: `You have a ${currentStreak}-day streak! Complete a session today to keep it going.`,
                tag: 'streak-reminder',
            });
        },

        streakMilestone(streak) {
            send(`🏆 ${streak}-Day Streak!`, {
                body: `Incredible! You've maintained focus for ${streak} days straight. Keep building!`,
                tag: 'streak-milestone',
            });
        },

        // ── Achievement Notifications ──────────────────
        achievementUnlocked(name) {
            send('🌟 Achievement Unlocked!', {
                body: `You earned: ${name}`,
                tag: 'achievement',
            });
        },

        // ── Streak Reminder Scheduler ──────────────────
        // Checks once per hour if the user hasn't focused today
        startStreakReminder(getLastFocusDate, getStreak) {
            this.stopStreakReminder(); // Clear any existing timer

            reminderTimerId = setInterval(() => {
                const lastFocus = getLastFocusDate();
                const streak = getStreak();
                if (!lastFocus || streak === 0) return;

                const today = new Date().toDateString();
                const lastDate = new Date(lastFocus).toDateString();

                // If user hasn't focused today and it's past 2PM, remind them
                if (lastDate !== today && new Date().getHours() >= 14) {
                    this.streakReminder(streak);
                }
            }, 60 * 60 * 1000); // Check every hour
        },

        stopStreakReminder() {
            if (reminderTimerId) {
                clearInterval(reminderTimerId);
                reminderTimerId = null;
            }
        },
    };
})();

window.NotificationManager = NotificationManager;
