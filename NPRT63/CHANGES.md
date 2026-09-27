# BUILDHAUS — Validation & fixes (Sept 2026)

## Requested changes
- **Crash sound on collapse.** `destroyHouse()` (GameScene) now calls `onDemolish` → `App.handleDemolish`, which plays `SoundManager.demolish()` inside the user's click and records the session as interrupted. Previously nothing ever triggered the sound. The crash is now a ~2.2 s layered impact + debris + rumble, as loud as the other game sounds, routed through a compressor so it never clips.
- **One Study logo everywhere.** `StudyLogo` (pixel house) is the only copy of the artwork; the floating button, the Study AI nav tab and the panel header all use it. A single floating button is rendered for the whole app (same spot on every screen and during a session); the nav tab toggles it; Escape closes it.
- **Smaller close (✕) button.** 76 px → 42 px, ✕ 28 px → 15 px (~45% smaller), centred on the same spot.
- **Readable, consistent panels.** Focus, Rewards, Profile, Community, Shop and Study AI share one dark frosted surface with crisp white text (AA contrast). Removed the global white text glow that made text blurry. Profile title centred like the other panels.
- **Thin sliders everywhere.** Focus duration and flashcard count use one `.app-slider` (4 px track). The mobile rule that turned the slider into a 44 px grey bar no longer shows.

## Bugs found by the tests and fixed
- Sessions: house count ignored earlier focus time (two 25-min sessions built 0 houses); `completed: "false"` counted as completed; fractional/negative inputs; stats returned `null` for new users; junk paging caused 500s. Session update now runs in one locked transaction.
- Quiz attempts: any score accepted (score > total, other users' sets, missing sets → 500).
- Shop: balance could be overdrawn by two quick purchases; non-text item ids caused 500s.
- Registration/profile: invalid gender or non-text password caused 500s.
- AI: non-text titles caused 500s; Groq errors leaked the upstream error body; now 502 with a safe message.
- Server: malformed JSON / oversized bodies returned 500 (now 400 / 413); the whole project folder (backend source, package files, write-ups) was publicly downloadable — now only `index.html`, `/src` and `/vendor` are served. JWT secret centralised in `backend/config/jwt.js` with a production warning.
- Frontend: a new 3D render loop was started (and never stopped) on every build stage; camera snapped back each stage; Study keyboard shortcuts stayed active while the panel was closed; quiz errors were never shown; "Review Cards" could open the wrong set; results screen was blank if saving failed; Subject field overflowed the Study panel; stale `?v=` cache versions meant browsers kept old files.

## Structure
- `backend/app.js` holds the Express app; `backend/server.js` only starts it (HTTP + WebSocket). Needed so tests can mount the app.

## Still worth knowing
- Quiz scores are reported by the browser, so a determined user could still replay perfect scores for coins. Fixing that properly means storing the generated quiz on the server and grading there.
- If your Render service wasn't created from `render.yaml`, make sure `JWT_SECRET` is set — otherwise the public fallback secret is used.
