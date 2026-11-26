-- CreateEnum
CREATE TYPE "employment_type" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR');

-- AlterEnum
ALTER TYPE "gender" ADD VALUE 'NON_BINARY';
ALTER TYPE "gender" ADD VALUE 'PREFER_NOT_TO_SAY';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employee_number" TEXT,
ADD COLUMN     "employment_type" "employment_type" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "hire_date" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- Hand-written: Prisma schema can't express CHECK constraints.
-- Services trim the employee number and store blank as NULL; this keeps
-- "", " A1" and "A1" from becoming three different unique values.
ALTER TABLE "employees" ADD CONSTRAINT "employees_employee_number_trimmed_check"
  CHECK ("employee_number" IS NULL OR ("employee_number" <> '' AND "employee_number" = btrim("employee_number")));
