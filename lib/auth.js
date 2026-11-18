const prisma = require('./prisma');

const HR_ACCESS = 1;

/**
 * Require a logged-in user. Re-reads the person row on every request so a
 * deleted user or a changed role takes effect immediately instead of living
 * on in an old session.
 */
function requireLogin(req, res, next) {
    if (!req.session || !req.session.idno) return res.redirect('/');
    prisma.person.findUnique({
        where: { id: String(req.session.idno) },
        select: { id: true, access: true }
    }).then(function(person) {
        if (!person) {
            return req.session.destroy(function() { res.redirect('/'); });
        }
        req.session.access = person.access;
        next();
    }).catch(next);
}

/** Require a logged-in HR user (access === 1). */
function requireHR(req, res, next) {
    requireLogin(req, res, function(err) {
        if (err) return next(err);
        if (req.session.access !== HR_ACCESS) {
            return res.status(403).send('Forbidden');
        }
        next();
    });
}

module.exports = { requireLogin, requireHR, HR_ACCESS };
