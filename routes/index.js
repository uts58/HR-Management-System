var express = require('express');
var router = express.Router();
var prisma = require('../lib/prisma');
var { requireLogin, requireHR } = require('../lib/auth');
var pw = require('../lib/password');
var { rateLimit, ipKeyGenerator } = require('express-rate-limit');
var sessionDb = require('../lib/session');

var LOGIN_WINDOW_MS = 15 * 60 * 1000;
function tooMany(req, res) {
    res.status(429).send('Too many attempts. Please wait a few minutes and try again.');
}
// Per client IP (set TRUST_PROXY behind a reverse proxy so req.ip is the real client).
var loginIpLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: parseInt(process.env.LOGIN_RATE_LIMIT_IP, 10) || 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany
});
// Per username + IP: limits guessing against one account from one client
// without letting an attacker elsewhere lock that account out for everyone.
var loginUserLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: parseInt(process.env.LOGIN_RATE_LIMIT_USER, 10) || 10,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: function(req) {
        var user = String((req.body && req.body.username) || '').toLowerCase().slice(0, 100);
        return 'user:' + ipKeyGenerator(req.ip) + ':' + user;
    },
    handler: tooMany
});

// Name is not unique, so try each candidate (bounded) rather than findFirst.
var MAX_LOGIN_CANDIDATES = 10;

async function findUserByCredentials(username, plain) {
    if (typeof username !== 'string' || typeof plain !== 'string' || !username || !plain) {
        return null;
    }
    const candidates = await prisma.person.findMany({
        where: { Name: { equals: username, mode: 'insensitive' } },
        orderBy: { id: 'asc' },
        take: MAX_LOGIN_CANDIDATES
    });
    if (candidates.length === 0) {
        await pw.burnTime(plain);
        return null;
    }
    for (const user of candidates) {
        const result = await pw.verifyPassword(plain, user.password);
        if (result.ok) {
            if (result.needsUpgrade) {
                // Lazy upgrade of a legacy plaintext password. Only overwrite if
                // the row still holds the value we just verified.
                const hashed = await pw.hashPassword(plain);
                await prisma.person.updateMany({
                    where: { id: user.id, password: user.password },
                    data: { password: hashed }
                });
            }
            return user;
        }
    }
    return null;
}

router.get('/', async function(req, res) {
    try {
        const notices = await prisma.notice.findMany();
        res.render("index", { title: 'Home', notices });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get("/home", requireLogin, async function(req, res) {
    try {
        const [user, notices, pendingLeaveCount] = await Promise.all([
            prisma.person.findUnique({ where: { id: req.session.idno } }),
            prisma.notice.findMany(),
            prisma.empLeave.count({ where: { status: 0 } })
        ]);

        if (user.access === 1) {
            res.render("welcome", {
                title: "hr",
                useracc: req.session.name,
                userid: req.session.idno,
                leave: pendingLeaveCount,
                notices
            });
        } else {
            const unreadLeaveCount = await prisma.empLeave.count({
                where: { empid: req.session.idno, read: 0, NOT: { status: 0 } }
            });
            res.render("welcome", {
                title: "emp",
                useracc: req.session.name,
                userid: req.session.idno,
                leave: unreadLeaveCount,
                notices
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/actAdmin", loginIpLimiter, loginUserLimiter, async function(req, res) {
    const username = req.body.username;
    const password = req.body.password;
    try {
        const user = await findUserByCredentials(username, password);
        if (!user) return res.send(false);
        // New session id on login (prevents session fixation).
        req.session.regenerate(function(err) {
            if (err) {
                console.error(err);
                return res.send(false);
            }
            req.session.idno = user.id;
            req.session.name = user.Name;
            req.session.access = user.access;
            req.session.save(function(err) {
                if (err) {
                    console.error(err);
                    return res.send(false);
                }
                res.send(true);
            });
        });
    } catch (err) {
        console.error(err);
        res.send(false);
    }
});

router.post("/logout", function(req, res, next) {
    req.session.destroy(function(err) {
        if (err) return next(err);
        res.clearCookie(req.app.get('session cookie name'));
        res.redirect("/");
    });
});

// ─── Notice management ────────────────────────────────────────────────────────

router.get("/addNotice", requireHR, async function(req, res) {
    try {
        const notices = await prisma.notice.findMany({ orderBy: { id: 'desc' } });
        res.render("addNotice", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            notices,
            saved: req.query.saved || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/saveNotice", requireHR, async function(req, res) {
    const { noticeTitle, notice, type } = req.body;
    try {
        await prisma.notice.create({
            data: {
                title: noticeTitle,
                notice,
                type: parseInt(type) || 0,
                date: new Date().toLocaleDateString()
            }
        });
        res.redirect('/addNotice?saved=1');
    } catch (err) {
        console.error(err);
        res.redirect('/addNotice');
    }
});

router.post("/deleteNotice", requireHR, async function(req, res) {
    const id = parseInt(req.body.id, 10);
    if (!id) return res.redirect('/addNotice');
    try {
        await prisma.notice.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/addNotice');
});

// ─── Leave management (HR) ────────────────────────────────────────────────────

router.get("/displayLeave", requireHR, async function(req, res) {
    try {
        const [leaves, employees] = await Promise.all([
            prisma.empLeave.findMany({ where: { status: 0 }, orderBy: { id: 'asc' } }),
            prisma.employee.findMany({ select: { id: true, firstName: true, lastName: true } })
        ]);
        res.render("displayLeave", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            leaves,
            employees
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/assignLeave", requireHR, async function(req, res) {
    const id = parseInt(req.body.id, 10);
    const status = parseInt(req.body.status, 10);
    // 1 = approved, 2 = rejected; anything else is a bad request.
    if (!id || String(status) !== String(req.body.status).trim() || (status !== 1 && status !== 2)) {
        return res.status(400).send('Invalid leave request or decision.');
    }
    try {
        // Only a pending (status 0) request can be decided.
        const result = await prisma.empLeave.updateMany({
            where: { id, status: 0 },
            data: { status, read: 0 }
        });
        if (result.count === 0) {
            const exists = await prisma.empLeave.count({ where: { id } });
            return exists
                ? res.status(409).send('This leave request has already been decided.')
                : res.status(404).send('Leave request not found.');
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send('Server error');
    }
    res.redirect('/displayLeave');
});

router.get("/viewLeavebyAdmin", requireHR, async function(req, res) {
    try {
        const [leaves, employees] = await Promise.all([
            prisma.empLeave.findMany({ orderBy: { id: 'desc' } }),
            prisma.employee.findMany({ select: { id: true, firstName: true, lastName: true } })
        ]);
        res.render("viewLeavebyAdmin", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            leaves,
            employees
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ─── Performance Appraisal (HR) ───────────────────────────────────────────────

router.get("/addPerformance", requireHR, async function(req, res) {
    try {
        const employees = await prisma.employee.findMany({
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: 'asc' }
        });
        res.render("addPerformance", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            employees,
            saved: req.query.saved || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/savePerformance", requireHR, async function(req, res) {
    const { empId, project_name, project_begin, project_end, rating } = req.body;
    try {
        await prisma.performance.create({
            data: {
                empId: parseInt(empId),
                project_name,
                project_begin,
                project_end,
                rating: parseInt(rating)
            }
        });
        res.redirect('/addPerformance?saved=1');
    } catch (err) {
        console.error(err);
        res.redirect('/addPerformance');
    }
});

router.get("/viewPerformance", requireHR, async function(req, res) {
    try {
        const [performances, employees] = await Promise.all([
            prisma.performance.findMany({ orderBy: { id: 'desc' } }),
            prisma.employee.findMany({ select: { id: true, firstName: true, lastName: true } })
        ]);
        res.render("viewPerformance", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            performances,
            employees
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/deletePerformance", requireHR, async function(req, res) {
    const id = parseInt(req.body.id, 10);
    if (!id) return res.redirect('/viewPerformance');
    try {
        await prisma.performance.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/viewPerformance');
});

// ─── Change Password ──────────────────────────────────────────────────────────

router.get("/changePassword", requireLogin, function(req, res) {
    res.render("changePassword", {
        title: req.session.access === 1 ? "hr" : "emp",
        useracc: req.session.name,
        userid: req.session.idno,
        error: req.query.error || '',
        success: req.query.success || 0
    });
});

router.post("/savePassword", loginIpLimiter, requireLogin, async function(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (typeof newPassword !== 'string' || typeof currentPassword !== 'string' || !newPassword) {
        return res.redirect('/changePassword?error=New+password+is+required');
    }
    if (newPassword !== confirmPassword) {
        return res.redirect('/changePassword?error=Passwords+do+not+match');
    }
    // bcrypt only uses the first 72 bytes; reject longer passwords rather than truncate silently.
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
        return res.redirect('/changePassword?error=Password+is+too+long');
    }
    try {
        const user = await prisma.person.findUnique({ where: { id: req.session.idno } });
        const check = user ? await pw.verifyPassword(currentPassword, user.password) : { ok: false };
        if (!check.ok) {
            return res.redirect('/changePassword?error=Current+password+is+incorrect');
        }
        await prisma.person.update({
            where: { id: req.session.idno },
            data: { password: await pw.hashPassword(newPassword) }
        });
        // Sign out every other session of this user; keep the current one.
        try {
            await sessionDb.destroyOtherSessions(req.session.idno, req.sessionID);
        } catch (err) {
            console.error('Could not revoke other sessions after password change:', err);
        }
        res.redirect('/changePassword?success=1');
    } catch (err) {
        console.error(err);
        res.redirect('/changePassword?error=Server+error');
    }
});

// ─── Leave (Employee) ─────────────────────────────────────────────────────────

router.get("/addLeave", requireLogin, function(req, res) {
    res.render("addLeave", {
        title: "emp",
        useracc: req.session.name,
        userid: req.session.idno,
        saved: req.query.saved || 0
    });
});

router.post("/saveLeave", requireLogin, async function(req, res) {
    const { leaveType, leaveStart, leaveEnd, description } = req.body;
    try {
        await prisma.empLeave.create({
            data: {
                empid: req.session.idno,
                leaveType,
                leaveStart,
                leaveEnd,
                description,
                status: 0,
                read: 0
            }
        });
        res.redirect('/addLeave?saved=1');
    } catch (err) {
        console.error(err);
        res.redirect('/addLeave');
    }
});

router.get("/viewLeave", requireLogin, async function(req, res) {
    try {
        const leaves = await prisma.empLeave.findMany({
            where: { empid: req.session.idno },
            orderBy: { id: 'desc' }
        });
        await prisma.empLeave.updateMany({
            where: { empid: req.session.idno, NOT: { status: 0 }, read: 0 },
            data: { read: 1 }
        });
        res.render("viewLeave", {
            title: "emp",
            useracc: req.session.name,
            userid: req.session.idno,
            leaves
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;