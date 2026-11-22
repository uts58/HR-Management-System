import "dotenv/config";
import { parseArgs } from "node:util";
import { createHrAdmin } from "@/server/employee/create-admin";

function fail(message: string): never {
  console.error(`create-admin: ${message}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      password: { type: "string" },
      "first-name": { type: "string" },
      "last-name": { type: "string" },
      email: { type: "string" },
    },
    strict: true,
  });
  const env = process.env;
  const username = values.username ?? env.CREATE_ADMIN_USERNAME;
  const password = values.password ?? env.CREATE_ADMIN_PASSWORD;
  if (!username) fail("--username (or CREATE_ADMIN_USERNAME) is required.");
  if (!password) fail("--password (or CREATE_ADMIN_PASSWORD) is required.");

  const result = await createHrAdmin({
    username,
    password,
    firstName: values["first-name"] ?? env.CREATE_ADMIN_FIRST_NAME,
    lastName: values["last-name"] ?? env.CREATE_ADMIN_LAST_NAME,
    email: values.email ?? env.CREATE_ADMIN_EMAIL,
  });
  console.log(
    result.created
      ? `create-admin: created HR admin "${result.username}" (employee #${result.employeeId}).`
      : `create-admin: HR admin "${result.username}" already exists; nothing changed.`,
  );
}

main()
  .catch((err: unknown) => {
    const e = err as { name?: string; message?: string; fieldErrors?: unknown };
    if (e?.name === "ServiceError") {
      const details = e.fieldErrors ? ` ${JSON.stringify(e.fieldErrors)}` : "";
      console.error(`create-admin: ${e.message}${details}`);
    } else {
      console.error(
        `create-admin: failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    process.exitCode = 1;
  })
  // Exit explicitly: the Prisma pool would otherwise keep the process alive.
  .finally(() => process.exit());
