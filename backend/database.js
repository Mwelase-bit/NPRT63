// database.js — SQLite database setup, schema, and seed data
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './buildhaus.db';
const db = new Database(path.resolve(DB_PATH));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create Tables ────────────────────────────────────────────────────────────

db.exec(`
  -- Users table: core player identity and stats
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    password        TEXT    NOT NULL,
    faculty         TEXT    NOT NULL CHECK(faculty IN ('nas','edu','ems','hum')),
    student_no      TEXT    UNIQUE,
    gender          TEXT    NOT NULL DEFAULT 'other' CHECK(gender IN ('male','female','other')),
    coins           INTEGER DEFAULT 100,
    streak          INTEGER DEFAULT 0,
    houses_built    INTEGER DEFAULT 0,
    total_focus_sec INTEGER DEFAULT 0,
    last_focus_date TEXT,
    created_at      TEXT    DEFAULT (datetime('now'))
  );

  -- Focus sessions: each recorded focus timer event
  CREATE TABLE IF NOT EXISTS focus_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    duration     INTEGER NOT NULL,   -- planned duration in seconds
    elapsed      INTEGER NOT NULL,   -- actual seconds elapsed
    completed    INTEGER NOT NULL,   -- 1 = completed, 0 = interrupted
    coins_earned INTEGER DEFAULT 0,
    created_at   TEXT    DEFAULT (datetime('now'))
  );

  -- Achievements: unlocked by meeting thresholds
  CREATE TABLE IF NOT EXISTS achievements (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT    NOT NULL,
    unlocked_at    TEXT    DEFAULT (datetime('now')),
    UNIQUE(user_id, achievement_id)
  );

  -- Shop catalogue: all purchasable items
  CREATE TABLE IF NOT EXISTS shop_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    category    TEXT    NOT NULL CHECK(category IN ('outfit','hat','tool','house','booster')),
    price       INTEGER NOT NULL CHECK(price >= 0),
    emoji       TEXT    NOT NULL DEFAULT '🎁',
    is_premium  INTEGER NOT NULL DEFAULT 0  -- 1 = gem-gated
  );

  -- User purchases: many-to-many between users and shop_items
  CREATE TABLE IF NOT EXISTS user_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id     TEXT    NOT NULL,
    purchased_at TEXT   DEFAULT (datetime('now')),
    UNIQUE(user_id, item_id)
  );
`);

// ─── Create Indexes for performance ──────────────────────────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date
    ON focus_sessions(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed
    ON focus_sessions(user_id, completed);
  CREATE INDEX IF NOT EXISTS idx_achievements_user
    ON achievements(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_items_user
    ON user_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_faculty
    ON users(faculty);
  CREATE INDEX IF NOT EXISTS idx_users_total_focus
    ON users(total_focus_sec DESC);
`);


// ─── Migrations: safely add new columns to existing databases ────────────────
// SQLite does not support IF NOT EXISTS for column adds, so we catch errors.
const migrations = [
  "ALTER TABLE users ADD COLUMN gender          TEXT    NOT NULL DEFAULT 'other'",
  "ALTER TABLE users ADD COLUMN houses_built    INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN total_focus_sec INTEGER NOT NULL DEFAULT 0",
];

for (const migration of migrations) {
  try {
    db.exec(migration);
  } catch (e) {
    // Column already exists — safe to ignore
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }
}

// ─── Migrations: add elapsed column to focus_sessions ────────────────────────
try {
  db.exec("ALTER TABLE focus_sessions ADD COLUMN elapsed INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  if (!e.message.includes('duplicate column name')) throw e;
}

// ─── Seed Shop Items (run only once) ─────────────────────────────────────────

const seedShopItems = db.transaction(() => {
  const insert = db.prepare(`
        INSERT OR IGNORE INTO shop_items (item_id, name, description, category, price, emoji, is_premium)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

  // Outfits
  insert.run('outfit_architect', 'Architect Suit', 'Sharp blazer for serious builders.', 'outfit', 300, '🤵', 0);
  insert.run('outfit_wizard', 'Wizard Robes', 'Mystical robes imbued with focus energy.', 'outfit', 500, '🧙', 0);
  insert.run('outfit_ninja', 'Ninja Gear', 'Silent and swift. Zero distractions.', 'outfit', 450, '🥷', 0);
  insert.run('outfit_knight', 'Knight Armour', 'Defend your focus with iron discipline.', 'outfit', 600, '⚔️', 0);
  insert.run('outfit_astronaut', 'Astronaut Suit', 'Focus beyond the stars.', 'outfit', 800, '🚀', 1);

  // Hats
  insert.run('hat_tophat', 'Top Hat', 'Classy headgear for elite builders.', 'hat', 150, '🎩', 0);
  insert.run('hat_crown', 'Gold Crown', 'For those at the top of the leaderboard.', 'hat', 400, '👑', 0);
  insert.run('hat_beret', 'Artist Beret', 'For the creatively productive.', 'hat', 200, '🎨', 0);
  insert.run('hat_beanie', 'Focus Beanie', 'Keeps the ideas warm and flowing.', 'hat', 120, '🧢', 0);
  insert.run('hat_helmet', 'Space Helmet', 'Ultimate protection from distractions.', 'hat', 700, '🪖', 1);

  // Tools
  insert.run('tool_wrench', 'Golden Wrench', 'Upgrade your build speed cosmetically.', 'tool', 200, '🔧', 0);
  insert.run('tool_paintbrush', 'Magic Paintbrush', 'Add colour to every finished house.', 'tool', 250, '🖌️', 0);
  insert.run('tool_drill', 'Power Drill', 'For builders who mean business.', 'tool', 350, '🔨', 0);
  insert.run('tool_wand', 'Enchanted Wand', 'Build with magic instead of muscle.', 'tool', 500, '🪄', 0);

  // Houses
  insert.run('house_mansion', 'Grand Mansion', 'A sprawling estate for high achievers.', 'house', 800, '🏛️', 0);
  insert.run('house_lighthouse', 'Lighthouse', 'Guide others to focus with your light.', 'house', 600, '🗼', 0);
  insert.run('house_treehouse', 'Treehouse', 'Elevated productivity, literally.', 'house', 400, '🌳', 0);
  insert.run('house_skyscraper', 'Skyscraper', 'Reach new heights with every session.', 'house', 1000, '🏙️', 0);
  insert.run('house_palace', 'Royal Palace', 'Reserved for the most dedicated builders.', 'house', 2000, '🏰', 1);

  // Boosters
  insert.run('booster_focus', 'Focus Potion', 'Double coins for your next session.', 'booster', 100, '⚗️', 0);
  insert.run('booster_streak', 'Streak Shield', 'Protect your streak for one missed day.', 'booster', 150, '🛡️', 0);
  insert.run('booster_xp', 'XP Amplifier', '50% more coins for the next 3 sessions.', 'booster', 200, '✨', 0);
});

seedShopItems();

console.log('✅ Database initialised at', DB_PATH);

module.exports = db;
