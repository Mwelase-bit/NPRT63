// database.js — PostgreSQL database setup, schema, and seed data
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Connection Pool ──────────────────────────────────────────────────────────
// DATABASE_URL is set automatically by Render's PostgreSQL addon (production)
// or manually in backend/.env for local development.
if (!process.env.DATABASE_URL) {
  console.error('\n❌ ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please configure DATABASE_URL in your backend/.env (local) or in your hosting environment variables (Render).\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// ─── Schema initialisation ────────────────────────────────────────────────────
// Called once at server startup. All statements are idempotent (IF NOT EXISTS).
async function initDatabase() {
  const client = await pool.connect();
  try {
    // ── Create tables ──────────────────────────────────────────────────────────
    await client.query(`
      -- Users: core player identity and stats
      CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        name            TEXT    NOT NULL,
        email           TEXT    NOT NULL UNIQUE,
        password        TEXT    NOT NULL,
        faculty         TEXT    NOT NULL CHECK(faculty IN ('nas','edu','ems','hum')),
        student_no      TEXT    UNIQUE,
        gender          TEXT    NOT NULL DEFAULT 'other'
                        CHECK(gender IN ('male','female','other')),
        coins           INTEGER NOT NULL DEFAULT 100,
        streak          INTEGER NOT NULL DEFAULT 0,
        houses_built    INTEGER NOT NULL DEFAULT 0,
        total_focus_sec INTEGER NOT NULL DEFAULT 0,
        last_focus_date TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Focus sessions: each recorded focus timer event
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        duration     INTEGER NOT NULL,
        elapsed      INTEGER NOT NULL DEFAULT 0,
        completed    BOOLEAN NOT NULL DEFAULT FALSE,
        coins_earned INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Achievements: unlocked by meeting thresholds
      CREATE TABLE IF NOT EXISTS achievements (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_id TEXT    NOT NULL,
        unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      );

      -- Shop catalogue: all purchasable items
      CREATE TABLE IF NOT EXISTS shop_items (
        id          SERIAL PRIMARY KEY,
        item_id     TEXT    NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        description TEXT    NOT NULL DEFAULT '',
        category    TEXT    NOT NULL
                    CHECK(category IN ('outfit','hat','tool','house','booster')),
        price       INTEGER NOT NULL CHECK(price >= 0),
        emoji       TEXT    NOT NULL DEFAULT '🎁',
        is_premium  INTEGER NOT NULL DEFAULT 0
      );

      -- User purchases: many-to-many between users and shop_items
      CREATE TABLE IF NOT EXISTS user_items (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id      TEXT    NOT NULL,
        purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, item_id)
      );

      -- AI Study: flashcard sets generated from pasted content
      CREATE TABLE IF NOT EXISTS flashcard_sets (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title        TEXT    NOT NULL,
        subject      TEXT    NOT NULL DEFAULT 'General',
        source_text  TEXT    NOT NULL,
        card_count   INTEGER NOT NULL DEFAULT 0,
        coins_earned INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- AI Study: individual flashcards belonging to a set
      CREATE TABLE IF NOT EXISTS flashcards (
        id       SERIAL PRIMARY KEY,
        set_id   INTEGER NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
        user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        front    TEXT NOT NULL,
        back     TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      );

      -- Quiz attempts: track each quiz taken by a user
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        set_id       INTEGER NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
        score        INTEGER NOT NULL DEFAULT 0,
        total        INTEGER NOT NULL DEFAULT 0,
        coins_earned INTEGER NOT NULL DEFAULT 0,
        taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Indexes for performance ────────────────────────────────────────────────
    await client.query(`
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
      CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user
        ON flashcard_sets(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_flashcards_set
        ON flashcards(set_id, position);
    `);

    // ── Seed shop items (idempotent) ──────────────────────────────────────────
    await client.query(`
      INSERT INTO shop_items (item_id, name, description, category, price, emoji, is_premium) VALUES
        -- Outfits
        ('outfit_architect', 'Architect Suit',   'Sharp blazer for serious builders.',       'outfit', 300,  '🤵', 0),
        ('outfit_wizard',    'Wizard Robes',      'Mystical robes imbued with focus energy.', 'outfit', 500,  '🧙', 0),
        ('outfit_ninja',     'Ninja Gear',        'Silent and swift. Zero distractions.',     'outfit', 450,  '🥷', 0),
        ('outfit_knight',    'Knight Armour',     'Defend your focus with iron discipline.',  'outfit', 600,  '⚔️', 0),
        ('outfit_astronaut', 'Astronaut Suit',    'Focus beyond the stars.',                  'outfit', 800,  '🚀', 1),
        -- Hats
        ('hat_tophat',  'Top Hat',      'Classy headgear for elite builders.',     'hat', 150, '🎩', 0),
        ('hat_crown',   'Gold Crown',   'For those at the top of the leaderboard.','hat', 400, '👑', 0),
        ('hat_beret',   'Artist Beret', 'For the creatively productive.',           'hat', 200, '🎨', 0),
        ('hat_beanie',  'Focus Beanie', 'Keeps the ideas warm and flowing.',        'hat', 120, '🧢', 0),
        ('hat_helmet',  'Space Helmet', 'Ultimate protection from distractions.',   'hat', 700, '🪖', 1),
        -- Tools
        ('tool_wrench',      'Golden Wrench',    'Upgrade your build speed cosmetically.',   'tool', 200, '🔧', 0),
        ('tool_paintbrush',  'Magic Paintbrush', 'Add colour to every finished house.',      'tool', 250, '🖌️', 0),
        ('tool_drill',       'Power Drill',      'For builders who mean business.',          'tool', 350, '🔨', 0),
        ('tool_wand',        'Enchanted Wand',   'Build with magic instead of muscle.',      'tool', 500, '🪄', 0),
        -- Houses
        ('house_mansion',    'Grand Mansion',  'A sprawling estate for high achievers.',        'house',  800, '🏛️', 0),
        ('house_lighthouse', 'Lighthouse',     'Guide others to focus with your light.',         'house',  600, '🗼', 0),
        ('house_treehouse',  'Treehouse',      'Elevated productivity, literally.',              'house',  400, '🌳', 0),
        ('house_skyscraper', 'Skyscraper',     'Reach new heights with every session.',          'house', 1000, '🏙️', 0),
        ('house_palace',     'Royal Palace',   'Reserved for the most dedicated builders.',      'house', 2000, '🏰', 1),
        -- Boosters
        ('booster_focus',  'Focus Potion',  'Double coins for your next session.',           'booster', 100, '⚗️', 0),
        ('booster_streak', 'Streak Shield', 'Protect your streak for one missed day.',       'booster', 150, '🛡️', 0),
        ('booster_xp',     'XP Amplifier',  '50% more coins for the next 3 sessions.',      'booster', 200, '✨', 0)
      ON CONFLICT (item_id) DO NOTHING;
    `);

    console.log('✅ PostgreSQL database initialised successfully');
  } catch (err) {
    console.error('❌ Database initialisation failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
