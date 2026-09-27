# BUILDHAUS

A gamified academic productivity application built for the NPRT63 Project course at Sol Plaatje University. BUILDHAUS (formerly prototyped as *AetherDrift 2*) turns focus sessions into a 3D building game: students set a focus timer, and a customisable builder character constructs a house or castle in stages while the timer runs. Complete the session without interruption and the structure stands, earning coins and achievements — get interrupted and it collapses.

This is a team-member development fork of [iammelvink/NPRT63](https://github.com/iammelvink/NPRT63).

## Features

- 3D building construction tied to a live focus timer
- AI-powered flashcard and quiz generation for study sessions
- Coin economy, achievements, and unlockable building/character customisations
- Leaderboards and an in-game shop
- Persistent progress via backend API + database

## Tech Stack

**Frontend**
- React 18, Three.js, React Three Fiber / Drei
- Bootstrap + custom CSS

**Backend** (`backend/`)
- Node.js + Express
- PostgreSQL (`pg`)
- JWT auth (`jsonwebtoken`, `bcryptjs`)
- Helmet, CORS

See [BUILDHAUS_Proposal.md](BUILDHAUS_Proposal.md) and [BUILDHAUS_Phase3.md](BUILDHAUS_Phase3.md) for the full project proposal and phase writeups.

## Running Locally

```bash
git clone https://github.com/Mwelase-bit/NPRT63.git
cd NPRT63
npm install

# Backend API (expects a PostgreSQL connection, see backend/database.js)
npm run server

# Frontend
npm run dev
```

Frontend serves on `http://localhost:3000` by default.

## Tests

The validation suite needs **Node.js 22.13+** and nothing else — no database,
no internet, no extra packages. It runs the real Express routes against a
throw-away in-memory SQLite database (via `backend/tests/helpers/pg-sqlite-shim.js`)
and a mocked Groq API.

```bash
npm test            # 149 validation tests: API, security, frontend compile, sounds, UI consistency
npm run test:e2e    # optional real-browser checks (needs: npm i -D playwright && npx playwright install chromium)
npm run test:live   # original smoke test against a running server + real PostgreSQL
```

| Folder | What it checks |
| --- | --- |
| `backend/tests/validation/` | auth & tokens, profile, focus sessions (coins, streaks, 45-min houses), shop, achievements, leaderboards, AI flashcards & quizzes, bad input, static-file exposure |
| `backend/tests/frontend/` | every script in `index.html` compiles with the vendored Babel, crash sound loudness/length/wiring, Study FAB logo & close-button size, panel/slider consistency and text contrast |
| `backend/tests/e2e/` | FAB position on every screen, thin sliders, one panel style, clicking the scene collapses the building + plays the crash + saves the interrupted session |

The SQLite shim is not a full Postgres emulator, so keep running `npm run test:live`
against your real database before deploying.
