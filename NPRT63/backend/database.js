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
  ssl: (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('render.com'))
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

      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_focus_sec INTEGER NOT NULL DEFAULT 0;

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

    // ── Usage analytics ────────────────────────────────────────────────────────
    // login_events: one row per sign-in (kind 'login') or app open with a saved
    // session (kind 'visit'). app_usage: seconds the app was open and visible,
    // summed into one row per user per hour.
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_events (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind       TEXT    NOT NULL DEFAULT 'login' CHECK(kind IN ('login','visit')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_usage (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hour_start TIMESTAMPTZ NOT NULL,
        seconds    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, hour_start)
      );
      CREATE INDEX IF NOT EXISTS idx_login_events_user_date
        ON login_events(user_id, created_at);
    `);

    // ── Social: friends, class groups and shared study rooms ───────────────────
    // user_codes: each student's shareable friend code. friendships: requests and
    // accepted friends. study_groups/group_members: class groups joined by invite
    // code, link or QR. study_rooms/room_members: a shared study session that
    // friends and group mates join; each member's status updates as they focus.
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_codes (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code    TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS friendships (
        id           SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (requester_id, addressee_id)
      );
      CREATE TABLE IF NOT EXISTS study_groups (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invite_code TEXT NOT NULL UNIQUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS group_members (
        group_id  INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role      TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS study_rooms (
        id           SERIAL PRIMARY KEY,
        host_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id     INTEGER REFERENCES study_groups(id) ON DELETE SET NULL,
        title        TEXT NOT NULL,
        duration_min INTEGER NOT NULL CHECK(duration_min BETWEEN 5 AND 720),
        invite_code  TEXT NOT NULL UNIQUE,
        status       TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at   TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_members (
        room_id    INTEGER NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status     TEXT NOT NULL DEFAULT 'joined' CHECK(status IN ('joined','focusing','completed','interrupted')),
        joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_user   ON group_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_room_members_user    ON room_members(user_id);
    `);

    // ── Notifications: in-app list, per-category switches and push subscriptions ──
    // notifications: everything a student has been told (shown in the bell menu).
    // notification_prefs: a row only exists once a category has been switched off or on.
    // push_subscriptions: one row per browser/device that allowed Web Push.
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category   TEXT NOT NULL,
        kind       TEXT NOT NULL,
        title      TEXT NOT NULL,
        body       TEXT,
        link       TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at    TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        enabled  INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, category)
      );
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint   TEXT NOT NULL UNIQUE,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_avatars (
        user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data       TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id);
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
    `);

    // ── Rewards: claimed bonuses and booster charges ──────────────────────────────
    // reward_claims: one row per bonus a student has taken for a period (a day or an ISO week),
    // so a bonus can only be claimed once per period. user_boosters: how many charges of each
    // shop booster a student has left.
    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_claims (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL,
        period     TEXT NOT NULL,
        coins      INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, kind, period)
      );
      CREATE TABLE IF NOT EXISTS user_boosters (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind    TEXT NOT NULL,
        charges INTEGER NOT NULL DEFAULT 0 CHECK(charges >= 0),
        PRIMARY KEY (user_id, kind)
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
