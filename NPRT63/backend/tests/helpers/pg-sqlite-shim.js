// backend/tests/helpers/pg-sqlite-shim.js
//
// A tiny stand-in for `pg.Pool` backed by Node's built-in SQLite (node:sqlite,
// Node >= 22.5). It lets the validation suite run the REAL Express routes
// against a throw-away in-memory database — no PostgreSQL server, no network,
// no extra npm packages.
//
// It only translates the PostgreSQL dialect this codebase actually uses
// ($1 placeholders, SERIAL, TIMESTAMPTZ/NOW(), ::date, INTERVAL, FOR UPDATE,
// unique-violation error codes). It is NOT a general Postgres emulator, which is
// why backend/tests/api.test.js (live smoke test against a real database) is kept.

let DatabaseSync;
try {
    ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
    DatabaseSync = null;
}

const isAvailable = () => DatabaseSync !== null;

// ─── Dialect translation ──────────────────────────────────────────────────────
function translate(sql) {
    return sql
        // Postgres-only DDL that SQLite can't parse and doesn't need here
        .replace(/ALTER TABLE\s+\w+\s+ADD COLUMN IF NOT EXISTS[^;]*;/gi, '')
        .replace(/\bSERIAL PRIMARY KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
        .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
        // (CURRENT_DATE - INTERVAL '7 days')  →  date('now','-7 days')
        .replace(/\(?\s*CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+)\s*days?'\s*\)?/gi, "date('now','-$1 days')")
        // created_at::date  →  date(created_at)
        .replace(/([\w.]+)::date\b/gi, 'date($1)')
        // SQLite has no row locks (it serialises writers), so drop FOR UPDATE
        .replace(/\bFOR UPDATE\b/gi, '')
        // Numbered placeholders: $1 → ?1
        .replace(/\$(\d+)/g, '?$1');
}

// Columns Postgres returns as real booleans
const BOOL_COLUMNS = new Set(['completed']);

function normaliseRow(row) {
    const out = { ...row };
    for (const k of Object.keys(out)) {
        if (BOOL_COLUMNS.has(k) && (out[k] === 0 || out[k] === 1)) out[k] = out[k] === 1;
    }
    return out;
}

function toParam(v) {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return v;
}

// Map SQLite constraint errors to the shape `pg` produces, so errorHandler.js
// and route code see the same `code` / `message` they would in production.
function toPgError(err) {
    const msg = String(err && err.message || err);
    const unique = msg.match(/UNIQUE constraint failed: ([\w.]+(?:, [\w.]+)*)/);
    if (unique) {
        const cols = unique[1].split(', ');
        const [table] = cols[0].split('.');
        const colNames = cols.map(c => c.split('.')[1]).join('_');
        const e = new Error(`duplicate key value violates unique constraint "${table}_${colNames}_key"`);
        e.code = '23505';
        return e;
    }
    if (/FOREIGN KEY constraint failed/.test(msg)) {
        const e = new Error('insert or update violates foreign key constraint');
        e.code = '23503';
        return e;
    }
    if (/CHECK constraint failed/.test(msg)) {
        const e = new Error('new row violates check constraint');
        e.code = '23514';
        return e;
    }
    return err;
}

class ShimClient {
    constructor(db) { this.db = db; }

    async query(text, params = []) {
        const sql = translate(text);
        try {
            // Multi-statement scripts without params (schema init) → exec
            if (params.length === 0 && sql.split(';').filter(s => s.trim()).length > 1) {
                this.db.exec(sql);
                return { rows: [], rowCount: 0 };
            }
            const trimmed = sql.trim();
            if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmed)) {
                this.db.exec(trimmed);
                return { rows: [], rowCount: 0 };
            }
            const stmt = this.db.prepare(sql);
            const bound = params.map(toParam);
            const returnsRows = /^\s*(SELECT|WITH)\b/i.test(trimmed) || /\bRETURNING\b/i.test(trimmed);
            if (returnsRows) {
                const rows = stmt.all(...bound).map(normaliseRow);
                return { rows, rowCount: rows.length };
            }
            const info = stmt.run(...bound);
            return { rows: [], rowCount: Number(info.changes) };
        } catch (err) {
            throw toPgError(err);
        }
    }

}

class Pool {
    constructor() {
        this._lock = Promise.resolve();
        if (!isAvailable()) {
            throw new Error('node:sqlite is not available — use Node.js 22.13+ to run the validation suite.');
        }
        this.db = new DatabaseSync(':memory:');
        this.db.exec('PRAGMA foreign_keys = ON;');
        this.client = new ShimClient(this.db);
    }
    query(text, params) { return this.client.query(text, params); }

    // pg hands each caller its own connection. We have one SQLite connection,
    // so checked-out clients are serialised: the next connect() waits until the
    // previous client is released. This keeps BEGIN/COMMIT blocks from
    // interleaving when tests fire concurrent requests.
    async connect() {
        let unlock;
        const prev = this._lock;
        this._lock = new Promise(r => { unlock = r; });
        await prev;
        const base = this.client;
        let released = false;
        return {
            query: (t, p) => base.query(t, p),
            release: () => { if (!released) { released = true; unlock(); } }
        };
    }
    async end() { this.db.close(); }
}

module.exports = { Pool, translate, isAvailable };
