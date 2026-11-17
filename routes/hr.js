var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var prisma = require('../lib/prisma');
var { requireLogin, requireHR } = require('../lib/auth');
var pw = require('../lib/password');

// Initial password for a new employee (CSPRNG; stored only as a bcrypt hash).
function randomString() {
    return crypto.randomBytes(12).toString('base64url');
}

router.get("/addEmployee", requireHR, async function(req, res) {
    try {
        const [departments, positions, lastEmp] = await Promise.all([
            prisma.department.findMany(),
            prisma.position.findMany(),
            prisma.employee.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
        ]);
        res.render("addEmployee", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            data: '',
            edit: '',
            department: departments,
            position: positions,
            idno: lastEmp ? lastEmp.id + 1 : 1,
            saved: 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get("/editEmployee", requireHR, async function(req, res) {
    var id = parseInt(req.query.id, 10);
    if (!id) return res.redirect('/');
    try {
        const [employee, departments, positions] = await Promise.all([
            prisma.employee.findUnique({ where: { id } }),
            prisma.department.findMany(),
            prisma.position.findMany()
        ]);
        if (!employee) return res.status(404).send('Employee not found');
        res.render("addEmployee", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            data: employee,
            edit: '1',
            department: departments,
            position: positions
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get("/viewDetails", requireHR, async function(req, res) {
    var id = parseInt(req.query.id, 10);
    if (!id) return res.redirect('/');
    try {
        const [employee, departments, positions] = await Promise.all([
            prisma.employee.findUnique({ where: { id } }),
            prisma.department.findMany(),
            prisma.position.findMany()
        ]);
        if (!employee) return res.status(404).send('Employee not found');
        res.render("addEmployee", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            data: employee,
            edit: '0',
            department: departments,
            position: positions
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get("/viewProfile", requireLogin, async function(req, res) {
    try {
        const [employee, departments, positions] = await Promise.all([
            prisma.employee.findUnique({ where: { id: parseInt(req.session.idno, 10) } }),
            prisma.department.findMany(),
            prisma.position.findMany()
        ]);
        if (!employee) return res.status(404).send('Employee not found');
        res.render("addEmployee", {
            title: "emp",
            useracc: req.session.name,
            userid: req.session.idno,
            data: employee,
            edit: '0',
            department: departments,
            position: positions
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get("/viewEmployee", requireHR, async function(req, res) {
    try {
        const [employees, positions] = await Promise.all([
            prisma.employee.findMany(),
            prisma.position.findMany()
        ]);
        res.render("viewEmployee", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            user: employees,
            data: positions,
            log: []
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/deleteEmployee", requireHR, async function(req, res) {
    var id = parseInt(req.body.id, 10);
    if (!id) return res.redirect('/hr/viewEmployee');
    // Don't let an HR user delete their own account.
    if (String(id) === String(req.session.idno)) return res.redirect('/hr/viewEmployee');
    try {
        await prisma.$transaction([
            prisma.employee.delete({ where: { id } }),
            prisma.person.delete({ where: { id: String(id) } })
        ]);
    } catch (err) {
        console.error(err);
    }
    res.redirect('/hr/viewEmployee');
});

router.post("/editEmp", requireHR, async function(req, res) {
    const posData = {
        firstName:    req.body.txtFirst,
        middleName:   req.body.txtMiddle,
        lastName:     req.body.txtLast,
        empId:        req.body.txtEmpId,
        dep:          req.body.department,
        pos:          req.body.position,
        country:      req.body.country,
        homeTown:     req.body.txtHomeTown,
        contact:      req.body.txtContact,
        email:        req.body.txtEmail,
        gender:       req.body.sex,
        maritalStatus: req.body.maritalStatus,
        dob:          req.body.date
    };
    try {
        await prisma.$transaction([
            prisma.employee.update({
                where: { id: parseInt(posData.empId) },
                data: {
                    firstName:    posData.firstName,
                    middleName:   posData.middleName,
                    lastName:     posData.lastName,
                    department:   parseInt(posData.dep),
                    position:     parseInt(posData.pos),
                    country:      posData.country,
                    homeTown:     posData.homeTown,
                    contactNo:    posData.contact,
                    email:        posData.email,
                    gender:       parseInt(posData.gender),
                    maritalStatus: posData.maritalStatus,
                    dateofBirth:  posData.dob
                }
            }),
            prisma.person.update({
                where: { id: String(posData.empId) },
                data: { Name: posData.firstName }
            })
        ]);
        res.redirect('/hr/viewEmployee');
    } catch (err) {
        console.error(err);
        res.redirect('/hr/viewEmployee');
    }
});

router.post("/saveEmp", requireHR, async function(req, res) {
    const posData = {
        firstName:    req.body.txtFirst,
        middleName:   req.body.txtMiddle,
        lastName:     req.body.txtLast,
        empId:        req.body.txtEmpId,
        dep:          req.body.department,
        pos:          req.body.position,
        country:      req.body.country,
        homeTown:     req.body.txtHomeTown,
        contact:      req.body.txtContact,
        email:        req.body.txtEmail,
        gender:       req.body.sex,
        maritalStatus: req.body.maritalStatus,
        dob:          req.body.date
    };
    try {
        const initialPassword = randomString();
        const initialPasswordHash = await pw.hashPassword(initialPassword);
        await prisma.$transaction([
            prisma.employee.create({
                data: {
                    id:           parseInt(posData.empId),
                    firstName:    posData.firstName,
                    middleName:   posData.middleName,
                    lastName:     posData.lastName,
                    department:   parseInt(posData.dep),
                    position:     parseInt(posData.pos),
                    country:      posData.country,
                    homeTown:     posData.homeTown,
                    contactNo:    posData.contact,
                    email:        posData.email,
                    gender:       parseInt(posData.gender),
                    maritalStatus: posData.maritalStatus,
                    dateofBirth:  posData.dob
                }
            }),
            prisma.person.create({
                data: {
                    id:       String(posData.empId),
                    Name:     posData.firstName,
                    password: initialPasswordHash,
                    access:   0
                }
            })
        ]);

        const [departments, positions, lastEmp] = await Promise.all([
            prisma.department.findMany(),
            prisma.position.findMany(),
            prisma.employee.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
        ]);
        // Shown to HR exactly once (POST response, not cacheable); only the hash is stored.
        res.set('Cache-Control', 'no-store');
        res.render("addEmployee", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            data: '',
            edit: '',
            department: departments,
            position: positions,
            idno: lastEmp ? lastEmp.id + 1 : 1,
            saved: 1,
            newUsername: posData.firstName,
            initialPassword
        });
    } catch (err) {
        console.error(err);
        res.redirect('/hr/viewEmployee');
    }
});

// ─── Department management ────────────────────────────────────────────────────

router.get("/addDep", requireHR, async function(req, res) {
    try {
        const departments = await prisma.department.findMany({ orderBy: { id: 'asc' } });
        res.render("addDep", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            departments,
            saved: req.query.saved || 0,
            error: req.query.error || ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/saveDep", requireHR, async function(req, res) {
    const { depName } = req.body;
    if (!depName || !depName.trim()) return res.redirect('/hr/addDep?error=Name+required');
    try {
        await prisma.department.create({ data: { departmentName: depName.trim() } });
        res.redirect('/hr/addDep?saved=1');
    } catch (err) {
        console.error(err);
        res.redirect('/hr/addDep?error=Failed+to+save');
    }
});

router.post("/deleteDep", requireHR, async function(req, res) {
    const id = parseInt(req.body.id, 10);
    if (!id) return res.redirect('/hr/addDep');
    try {
        await prisma.department.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/hr/addDep');
});

// ─── Position management ──────────────────────────────────────────────────────

router.get("/addPos", requireHR, async function(req, res) {
    try {
        const positions = await prisma.position.findMany({ orderBy: { id: 'asc' } });
        res.render("addPos", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            positions,
            saved: req.query.saved || 0,
            error: req.query.error || ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post("/savePos", requireHR, async function(req, res) {
    const { posName } = req.body;
    if (!posName || !posName.trim()) return res.redirect('/hr/addPos?error=Name+required');
    try {
        await prisma.position.create({ data: { positionName: posName.trim() } });
        res.redirect('/hr/addPos?saved=1');
    } catch (err) {
        console.error(err);
        res.redirect('/hr/addPos?error=Failed+to+save');
    }
});

router.post("/deletePos", requireHR, async function(req, res) {
    const id = parseInt(req.body.id, 10);
    if (!id) return res.redirect('/hr/addPos');
    try {
        await prisma.position.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/hr/addPos');
});

module.exports = router;