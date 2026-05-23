const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Departments
    await prisma.department.upsert({ where: { id: 1 }, update: {}, create: { id: 1, departmentName: 'Human Resources' } });
    await prisma.department.upsert({ where: { id: 2 }, update: {}, create: { id: 2, departmentName: 'Engineering' } });
    await prisma.department.upsert({ where: { id: 3 }, update: {}, create: { id: 3, departmentName: 'Finance' } });
    await prisma.department.upsert({ where: { id: 4 }, update: {}, create: { id: 4, departmentName: 'Marketing' } });
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('department', 'id'), MAX(id)) FROM department`;

    // Positions
    await prisma.position.upsert({ where: { id: 1 }, update: {}, create: { id: 1, positionName: 'HR Manager' } });
    await prisma.position.upsert({ where: { id: 2 }, update: {}, create: { id: 2, positionName: 'Software Engineer' } });
    await prisma.position.upsert({ where: { id: 3 }, update: {}, create: { id: 3, positionName: 'Accountant' } });
    await prisma.position.upsert({ where: { id: 4 }, update: {}, create: { id: 4, positionName: 'Marketing Specialist' } });
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('position', 'id'), MAX(id)) FROM position`;

    // HR admin (access=1) — id=1 is skipped in the employee listing view
    await prisma.person.upsert({
        where: { id: '1' },
        update: {},
        create: { id: '1', Name: 'admin', password: 'admin123', access: 1 }
    });
    await prisma.employee.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, firstName: 'Admin', middleName: '', lastName: 'User', department: 1, position: 1, email: 'admin@company.com', gender: 1, country: 'USA' }
    });

    // Sample employee (access=0)
    await prisma.person.upsert({
        where: { id: '2' },
        update: {},
        create: { id: '2', Name: 'john', password: 'emp123', access: 0 }
    });
    await prisma.employee.upsert({
        where: { id: 2 },
        update: {},
        create: { id: 2, firstName: 'John', middleName: 'A', lastName: 'Doe', department: 2, position: 2, email: 'john.doe@company.com', gender: 1, country: 'USA', contactNo: '555-0100', homeTown: 'New York', maritalStatus: 'single', dateofBirth: '01 Jan 1990' }
    });

    // Welcome notice
    await prisma.notice.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, title: 'Welcome to the HR Portal', notice: 'Welcome to the HR Management System. Please log in and update your profile information.', type: 0, date: new Date().toLocaleDateString() }
    });
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('notice', 'id'), MAX(id)) FROM notice`;

    console.log('Seed complete.');
    console.log('  HR login  — username: admin   password: admin123');
    console.log('  Emp login — username: john    password: emp123');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());