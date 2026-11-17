const crypto = require('crypto');
// Native (Rust) bcrypt with prebuilt binaries for Windows, glibc and musl Linux.
// hash/verify run on the libuv thread pool, not the main event loop thread.
const bcrypt = require('@node-rs/bcrypt');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Used so failed logins (unknown user, wrong legacy password) cost the same
// as a real bcrypt comparison.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

function isHashed(stored) {
    return typeof stored === 'string' && BCRYPT_RE.test(stored);
}

async function hashPassword(plain) {
    const h = await bcrypt.hash(String(plain), BCRYPT_ROUNDS);
    // @node-rs/bcrypt emits "$2y$", which is the same algorithm as "$2b$".
    // Store the more widely recognised "$2b$" prefix.
    return h.startsWith('$2y$') ? '$2b$' + h.slice(4) : h;
}

// Constant-time string comparison (hash both sides so lengths always match).
function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function burnTime(plain) {
    return bcrypt.verify(String(plain || ''), DUMMY_HASH).then(() => false);
}

/**
 * Check a password against a stored value, which may be a bcrypt hash or a
 * legacy plaintext password. Returns { ok, needsUpgrade }.
 */
async function verifyPassword(plain, stored) {
    if (typeof plain !== 'string' || typeof stored !== 'string') {
        await burnTime(plain);
        return { ok: false, needsUpgrade: false };
    }
    if (isHashed(stored)) {
        return { ok: await bcrypt.verify(plain, stored), needsUpgrade: false };
    }
    // Legacy plaintext row: compare in constant time; caller re-hashes on success.
    // On failure spend a bcrypt compare so the response time doesn't reveal
    // that this account still has a plaintext password.
    const ok = safeEqual(plain, stored);
    if (!ok) await burnTime(plain);
    return { ok, needsUpgrade: true };
}

module.exports = { isHashed, hashPassword, verifyPassword, burnTime, safeEqual };
