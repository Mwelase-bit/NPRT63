// utils/rewardRules.js - the numbers behind rewards, in one place so the server routes,
// the tests and the Rewards screen (which fetches them) can never disagree.

// One-off coins paid when a streak reaches this many days
const STREAK_MILESTONE_COINS = { 3: 30, 7: 70, 14: 140, 30: 300, 50: 500, 100: 1000 };

// Bonuses a student can claim once per period (a day, or an ISO week)
const CLAIMS = {
    daily_login:      { coins: 50,  period: 'day',  label: 'Daily check-in' },
    daily_progress:   { coins: 200, period: 'day',  label: 'Daily goal', needs: { sessions: 5, minutes: 120 } },   // either target counts
    weekly_challenge: { coins: 500, period: 'week', label: 'Weekly challenge', needs: { sessions: 20 } }
};

// Shop boosters are consumables. `kind` is the stock the charges are added to.
//   focus_potion  - doubles the coins of the next completed session
//   streak_shield - saves the streak once if exactly one day was missed
//   xp_amplifier  - +50% coins for the next 3 completed sessions
const BOOSTERS = {
    booster_focus:  { kind: 'focus_potion',  charges: 1 },
    booster_streak: { kind: 'streak_shield', charges: 1 },
    booster_xp:     { kind: 'xp_amplifier',  charges: 3 }
};

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

// ISO week key like "2026-W42" plus the Monday that week starts on (UTC)
function weekInfo(d = new Date()) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;                           // Monday = 1 ... Sunday = 7
    const monday = new Date(t.getTime() - (day - 1) * 86400000);
    const thursday = new Date(monday.getTime() + 3 * 86400000);
    const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
    return { key: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, start: monday.toISOString().slice(0, 10) };
}

module.exports = { STREAK_MILESTONE_COINS, CLAIMS, BOOSTERS, dayKey, weekInfo };
