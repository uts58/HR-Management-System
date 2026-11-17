const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Used so a login for an unknown user costs the same as one for a known user.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

function isHashed(stored) {
    return typeof stored === 'string' && BCRYPT_RE.test(stored);
}

function hashPassword(plain) {
    return bcrypt.hash(String(plain), BCRYPT_ROUNDS);
}

// Constant-time string comparison (hash both sides so lengths always match).
function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/**
 * Check a password against a stored value, which may be a bcrypt hash or a
 * legacy plaintext password. Returns { ok, needsUpgrade }.
 */
async function verifyPassword(plain, stored) {
    if (typeof plain !== 'string' || typeof stored !== 'string') {
        return { ok: false, needsUpgrade: false };
    }
    if (isHashed(stored)) {
        return { ok: await bcrypt.compare(plain, stored), needsUpgrade: false };
    }
    // Legacy plaintext row: compare in constant time; caller re-hashes on success.
    return { ok: safeEqual(plain, stored), needsUpgrade: true };
}

function burnTime(plain) {
    return bcrypt.compare(String(plain || ''), DUMMY_HASH).then(() => false);
}

module.exports = { isHashed, hashPassword, verifyPassword, burnTime, safeEqual };
