var express = require('express');
var router = express.Router();
var prisma = require('../lib/prisma');

router.get('/', async function(req, res) {
    try {
        const notices = await prisma.notice.findMany();
        res.render("index", { title: 'Home', notices });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/home', async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.post("/actAdmin", async function(req, res) {
    const { username, password } = req.body;
    try {
        const user = await prisma.person.findFirst({
            where: { Name: { equals: username, mode: 'insensitive' }, password }
        });
        if (user) {
            req.session.idno = user.id;
            req.session.name = username;
            req.session.access = user.access;
            res.send(true);
        } else {
            res.send(false);
        }
    } catch (err) {
        console.error(err);
        res.send(false);
    }
});

router.get("/logout", function(req, res) {
    if (req.session.name) req.session.destroy();
    res.redirect("/");
});

// ─── Notice management ────────────────────────────────────────────────────────

router.get("/addNotice", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.post("/saveNotice", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/deleteNotice", async function(req, res) {
    if (!req.session.name) return res.redirect('/addNotice');
    const id = parseInt(req.query.id);
    if (!id) return res.redirect('/addNotice');
    try {
        await prisma.notice.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/addNotice');
});

// ─── Leave management (HR) ────────────────────────────────────────────────────

router.get("/displayLeave", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/assignLeave", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
    const id = parseInt(req.query.id);
    const status = parseInt(req.query.status);
    if (!id || isNaN(status)) return res.redirect('/displayLeave');
    try {
        await prisma.empLeave.update({ where: { id }, data: { status, read: 0 } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/displayLeave');
});

router.get("/viewLeavebyAdmin", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/addPerformance", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.post("/savePerformance", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/viewPerformance", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/deletePerformance", async function(req, res) {
    if (!req.session.name) return res.redirect('/viewPerformance');
    const id = parseInt(req.query.id);
    if (!id) return res.redirect('/viewPerformance');
    try {
        await prisma.performance.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/viewPerformance');
});

// ─── Change Password ──────────────────────────────────────────────────────────

router.get("/changePassword", function(req, res) {
    if (!req.session.name) return res.redirect("/");
    res.render("changePassword", {
        title: req.session.access === 1 ? "hr" : "emp",
        useracc: req.session.name,
        userid: req.session.idno,
        error: req.query.error || '',
        success: req.query.success || 0
    });
});

router.post("/savePassword", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
        return res.redirect('/changePassword?error=Passwords+do+not+match');
    }
    try {
        const user = await prisma.person.findUnique({ where: { id: req.session.idno } });
        if (!user || user.password !== currentPassword) {
            return res.redirect('/changePassword?error=Current+password+is+incorrect');
        }
        await prisma.person.update({
            where: { id: req.session.idno },
            data: { password: newPassword }
        });
        res.redirect('/changePassword?success=1');
    } catch (err) {
        console.error(err);
        res.redirect('/changePassword?error=Server+error');
    }
});

// ─── Leave (Employee) ─────────────────────────────────────────────────────────

router.get("/addLeave", function(req, res) {
    if (!req.session.name) return res.redirect("/");
    res.render("addLeave", {
        title: "emp",
        useracc: req.session.name,
        userid: req.session.idno,
        saved: req.query.saved || 0
    });
});

router.post("/saveLeave", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/viewLeave", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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