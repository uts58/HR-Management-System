import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash as argon2Hash } from "@node-rs/argon2";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_PROD_SEED !== "1"
) {
  console.error(
    "Refusing to seed with NODE_ENV=production (set ALLOW_PROD_SEED=1 to override).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function main() {
  const departments = [
    "Human Resources",
    "Engineering",
    "Finance",
    "Marketing",
  ];
  const positions = [
    "HR Manager",
    "Software Engineer",
    "Accountant",
    "Marketing Specialist",
  ];
  for (const [i, name] of departments.entries()) {
    await prisma.department.upsert({
      where: { id: i + 1 },
      update: { name },
      create: { id: i + 1, name },
    });
  }
  for (const [i, name] of positions.entries()) {
    await prisma.position.upsert({
      where: { id: i + 1 },
      update: { name },
      create: { id: i + 1, name },
    });
  }

  const employees: Prisma.EmployeeUncheckedCreateInput[] = [
    {
      id: 1,
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      contactNo: "555-0100",
      country: "USA",
      homeTown: "Austin",
      gender: "FEMALE",
      maritalStatus: "MARRIED",
      dateOfBirth: d("1985-04-12"),
      departmentId: 1,
      positionId: 1,
      employmentType: "FULL_TIME",
      hireDate: d("2015-03-02"),
      employeeNumber: "EMP-0001",
    },
    {
      id: 2,
      firstName: "John",
      middleName: "A",
      lastName: "Doe",
      email: "john.doe@example.com",
      contactNo: "555-0101",
      country: "USA",
      homeTown: "New York",
      gender: "MALE",
      maritalStatus: "SINGLE",
      dateOfBirth: d("1990-01-01"),
      departmentId: 2,
      positionId: 2,
      employmentType: "FULL_TIME",
      hireDate: d("2019-06-17"),
      employeeNumber: "EMP-0002",
    },
    {
      id: 3,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      contactNo: "555-0102",
      country: "Canada",
      homeTown: "Toronto",
      gender: "FEMALE",
      maritalStatus: "SINGLE",
      dateOfBirth: d("1994-09-23"),
      departmentId: 3,
      positionId: 3,
      employmentType: "PART_TIME",
      hireDate: d("2022-01-10"),
      employeeNumber: "EMP-0003",
    },
    {
      id: 4,
      firstName: "Raj",
      lastName: "Patel",
      email: "raj.patel@example.com",
      contactNo: "555-0103",
      country: "India",
      homeTown: "Pune",
      gender: "NON_BINARY",
      maritalStatus: "MARRIED",
      dateOfBirth: d("1988-02-29"),
      departmentId: 4,
      positionId: 4,
      employmentType: "CONTRACTOR",
      hireDate: d("2024-09-01"),
      employeeNumber: null,
    },
    {
      id: 5,
      firstName: "Mary",
      lastName: "Jones",
      email: "mary.jones@example.com",
      contactNo: "555-0104",
      country: "Australia",
      homeTown: "Perth",
      gender: "FEMALE",
      maritalStatus: "DIVORCED",
      dateOfBirth: d("1979-11-30"),
      departmentId: 2,
      positionId: 2,
      employmentType: "FULL_TIME",
      hireDate: d("2018-02-05"),
      employeeNumber: "EMP-0005",
      employmentStatus: "TERMINATED",
      terminatedAt: new Date("2026-06-30T17:00:00Z"),
    },
  ];
  for (const e of employees) {
    const { id, ...rest } = e;
    await prisma.employee.upsert({
      where: { id: id! },
      update: rest,
      create: e,
    });
  }

  const adminHash = await argon2Hash("Admin#12345");
  const empHash = await argon2Hash("Employee#123");
  const users = [
    {
      id: "seed-user-1",
      employeeId: 1,
      username: "admin",
      name: "Admin User",
      email: "admin@example.com",
      role: "HR_ADMIN" as const,
      hash: adminHash,
      mustChangePassword: false,
      disabledAt: null,
    },
    {
      id: "seed-user-2",
      employeeId: 2,
      username: "john.doe",
      name: "John A Doe",
      email: "john.doe@example.com",
      role: "EMPLOYEE" as const,
      hash: empHash,
      mustChangePassword: false,
      disabledAt: null,
    },
    {
      id: "seed-user-3",
      employeeId: 3,
      username: "jane.smith",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      role: "EMPLOYEE" as const,
      hash: empHash,
      mustChangePassword: true,
      disabledAt: null,
    },
    {
      id: "seed-user-4",
      employeeId: 4,
      username: "raj.patel",
      name: "Raj Patel",
      email: "raj.patel@example.com",
      role: "EMPLOYEE" as const,
      hash: empHash,
      mustChangePassword: false,
      disabledAt: null,
    },
    {
      id: "seed-user-5",
      employeeId: 5,
      username: "mary.jones",
      name: "Mary Jones",
      email: "mary.jones@example.com",
      role: "EMPLOYEE" as const,
      hash: empHash,
      mustChangePassword: false,
      disabledAt: new Date("2026-06-30T17:00:00Z"),
    },
  ];
  for (const { hash, ...u } of users) {
    const data = { ...u, displayUsername: u.username, emailVerified: false };
    await prisma.user.upsert({
      where: { id: u.id },
      update: data,
      create: data,
    });
    await prisma.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: u.id },
      },
      update: { password: hash },
      create: {
        id: `seed-account-${u.employeeId}`,
        providerId: "credential",
        accountId: u.id,
        userId: u.id,
        password: hash,
      },
    });
  }

  const leave: Prisma.LeaveRequestUncheckedCreateInput[] = [
    {
      id: 1,
      employeeId: 2,
      leaveType: "SICK",
      startDate: d("2026-10-05"),
      endDate: d("2026-10-06"),
      reason: "Flu",
      status: "APPROVED",
      decidedById: "seed-user-1",
      decidedAt: new Date("2026-10-04T15:00:00Z"),
      seenByEmployee: true,
    },
    {
      id: 2,
      employeeId: 2,
      leaveType: "ANNUAL",
      startDate: d("2026-12-22"),
      endDate: d("2026-12-31"),
      reason: "Holidays",
      status: "PENDING",
      seenByEmployee: true,
    },
    {
      id: 3,
      employeeId: 3,
      leaveType: "CASUAL",
      startDate: d("2026-11-20"),
      endDate: d("2026-11-20"),
      reason: null,
      status: "REJECTED",
      decidedById: "seed-user-1",
      decidedAt: new Date("2026-11-16T09:30:00Z"),
      seenByEmployee: false,
    },
    {
      id: 4,
      employeeId: 4,
      leaveType: "UNPAID",
      startDate: d("2027-01-10"),
      endDate: d("2027-01-14"),
      reason: "Family matter",
      status: "PENDING",
      seenByEmployee: true,
    },
  ];
  for (const l of leave) {
    const { id, ...rest } = l;
    await prisma.leaveRequest.upsert({
      where: { id: id! },
      update: rest,
      create: l,
    });
  }

  const notices: Prisma.NoticeUncheckedCreateInput[] = [
    {
      id: 1,
      title: "Welcome to the HR Portal",
      body: "Please log in and check your profile information.",
      type: "GENERAL",
      createdAt: new Date("2026-11-01T09:00:00Z"),
    },
    {
      id: 2,
      title: "Server maintenance tonight",
      body: "The portal will be unavailable from 22:00 to 23:00 UTC.",
      type: "URGENT",
      createdAt: new Date("2026-11-15T12:00:00Z"),
    },
    {
      id: 3,
      title: "Year-end holiday",
      body: "The office is closed from 24 December to 1 January.",
      type: "HOLIDAY",
      createdAt: new Date("2026-11-16T08:00:00Z"),
    },
  ];
  for (const n of notices) {
    const { id, ...rest } = n;
    await prisma.notice.upsert({ where: { id: id! }, update: rest, create: n });
  }

  const appraisals: Prisma.AppraisalUncheckedCreateInput[] = [
    {
      id: 1,
      employeeId: 2,
      projectName: "Payroll revamp",
      projectStart: d("2026-01-05"),
      projectEnd: d("2026-06-30"),
      rating: 4,
    },
    {
      id: 2,
      employeeId: 3,
      projectName: "Quarterly close automation",
      projectStart: d("2026-03-01"),
      projectEnd: d("2026-05-31"),
      rating: 5,
    },
    {
      id: 3,
      employeeId: 5,
      projectName: "Legacy API retirement",
      projectStart: d("2025-09-01"),
      projectEnd: d("2026-02-28"),
      rating: 3,
    },
  ];
  for (const a of appraisals) {
    const { id, ...rest } = a;
    await prisma.appraisal.upsert({
      where: { id: id! },
      update: rest,
      create: a,
    });
  }

  for (const t of [
    "departments",
    "positions",
    "employees",
    "leave_requests",
    "notices",
    "appraisals",
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 0) + 1, false)`,
    );
  }

  console.log(
    "Seed complete. Logins: admin / Admin#12345, john.doe / Employee#123 (dev only).",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
