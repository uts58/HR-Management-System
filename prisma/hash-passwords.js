// One-off: bcrypt-hash every remaining plaintext password in the person table.
// Optional. Logins already upgrade plaintext passwords lazily; this finishes
// the job for users who have not logged in since the deploy.
//
//   node prisma/hash-passwords.js            # hash them
//   node prisma/hash-passwords.js --dry-run  # only count them
//
// Safe to re-run: rows that already hold a bcrypt hash are skipped, and each
// update only applies if the row still holds the plaintext value we read.
const { PrismaClient } = require('@prisma/client');
const { isHashed, hashPassword } = require('../lib/password');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
    const people = await prisma.person.findMany({ select: { id: true, password: true } });
    const plaintext = people.filter(p => !isHashed(p.password));
    console.log(`${people.length} users, ${plaintext.length} with plaintext passwords.`);
    if (dryRun || plaintext.length === 0) return;

    let updated = 0;
    for (const p of plaintext) {
        const res = await prisma.person.updateMany({
            where: { id: p.id, password: p.password },
            data: { password: await hashPassword(p.password) }
        });
        updated += res.count;
    }
    console.log(`Hashed ${updated} passwords.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
