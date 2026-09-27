// config/jwt.js — single source of truth for the JWT signing secret.
// The hard-coded fallback only exists so local development works without setup.
// It is public (it's in the repo), so anyone could forge tokens with it —
// production must always set JWT_SECRET (render.yaml generates one).
const FALLBACK = 'fallback_secret_for_render_123';
const JWT_SECRET = process.env.JWT_SECRET || FALLBACK;

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  JWT_SECRET is not set in production — using the public fallback secret. ' +
                 'Set JWT_SECRET in your hosting environment variables immediately.');
}

module.exports = { JWT_SECRET };
