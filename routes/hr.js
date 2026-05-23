var express = require('express');
var router = express.Router();
var prisma = require('../lib/prisma');

function randomString() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var result = '';
    for (var i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

router.get("/addEmployee", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/editEmployee", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
    var id = require('url').parse(req.url, true).query.id;
    if (!id) return res.redirect('/');
    try {
        const [employee, departments, positions] = await Promise.all([
            prisma.employee.findUnique({ where: { id: parseInt(id) } }),
            prisma.department.findMany(),
            prisma.position.findMany()
        ]);
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

router.get("/viewDetails", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
    var id = require('url').parse(req.url, true).query.id;
    if (!id) return res.redirect('/');
    try {
        const [employee, departments, positions] = await Promise.all([
            prisma.employee.findUnique({ where: { id: parseInt(id) } }),
            prisma.department.findMany(),
            prisma.position.findMany()
        ]);
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

router.get("/viewProfile", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
    try {
        const [employee, departments, positions] = await Promise.all([
            prisma.employee.findUnique({ where: { id: parseInt(req.session.idno) } }),
            prisma.department.findMany(),
            prisma.position.findMany()
        ]);
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

router.get("/viewEmployee", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
    try {
        const [employees, positions, persons] = await Promise.all([
            prisma.employee.findMany(),
            prisma.position.findMany(),
            prisma.person.findMany()
        ]);
        res.render("viewEmployee", {
            title: "hr",
            useracc: req.session.name,
            userid: req.session.idno,
            user: employees,
            data: positions,
            log: persons
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get("/deleteEmployee", async function(req, res) {
    if (!req.session.name) return res.redirect('/hr/viewEmployee');
    var id = require('url').parse(req.url, true).query.id;
    if (!id) return res.redirect('/hr/viewEmployee');
    try {
        await prisma.$transaction([
            prisma.employee.delete({ where: { id: parseInt(id) } }),
            prisma.person.delete({ where: { id: String(id) } })
        ]);
    } catch (err) {
        console.error(err);
    }
    res.redirect('/hr/viewEmployee');
});

router.post("/editEmp", async function(req, res) {
    if (!req.session.name) return res.redirect('/');
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

router.post("/saveEmp", async function(req, res) {
    if (!req.session.name) return res.redirect('/');
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
                    password: randomString(),
                    access:   0
                }
            })
        ]);

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
            saved: 1
        });
    } catch (err) {
        console.error(err);
        res.redirect('/hr/viewEmployee');
    }
});

// ─── Department management ────────────────────────────────────────────────────

router.get("/addDep", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.post("/saveDep", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/deleteDep", async function(req, res) {
    if (!req.session.name) return res.redirect('/hr/addDep');
    const id = parseInt(req.query.id);
    if (!id) return res.redirect('/hr/addDep');
    try {
        await prisma.department.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/hr/addDep');
});

// ─── Position management ──────────────────────────────────────────────────────

router.get("/addPos", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.post("/savePos", async function(req, res) {
    if (!req.session.name) return res.redirect("/");
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

router.get("/deletePos", async function(req, res) {
    if (!req.session.name) return res.redirect('/hr/addPos');
    const id = parseInt(req.query.id);
    if (!id) return res.redirect('/hr/addPos');
    try {
        await prisma.position.delete({ where: { id } });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/hr/addPos');
});

module.exports = router;