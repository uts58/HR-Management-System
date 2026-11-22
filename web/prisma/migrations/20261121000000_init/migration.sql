-- CreateEnum
CREATE TYPE "role" AS ENUM ('EMPLOYEE', 'HR_ADMIN');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "marital_status" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED');

-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('ACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "leave_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "leave_type" AS ENUM ('SICK', 'ANNUAL', 'CASUAL', 'MATERNITY', 'UNPAID');

-- CreateEnum
CREATE TYPE "notice_type" AS ENUM ('GENERAL', 'URGENT', 'HOLIDAY');

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "contact_no" TEXT,
    "country" TEXT,
    "home_town" TEXT,
    "gender" "gender",
    "marital_status" "marital_status",
    "date_of_birth" DATE,
    "department_id" INTEGER,
    "position_id" INTEGER,
    "employment_status" "employment_status" NOT NULL DEFAULT 'ACTIVE',
    "terminated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type" "leave_type" NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "reason" TEXT,
    "status" "leave_status" NOT NULL DEFAULT 'PENDING',
    "seen_by_employee" BOOLEAN NOT NULL DEFAULT true,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "notice_type" NOT NULL DEFAULT 'GENERAL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisals" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "project_name" TEXT,
    "project_start" DATE,
    "project_end" DATE,
    "rating" SMALLINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT NOT NULL,
    "display_username" TEXT,
    "role" "role" NOT NULL DEFAULT 'EMPLOYEE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "employee_id" INTEGER,
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_position_id_idx" ON "employees"("position_id");

-- CreateIndex
CREATE INDEX "employees_employment_status_idx" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_last_name_first_name_idx" ON "employees"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_status_id_idx" ON "leave_requests"("status", "id");

-- CreateIndex
CREATE INDEX "notices_created_at_idx" ON "notices"("created_at" DESC);

-- CreateIndex
CREATE INDEX "appraisals_employee_id_idx" ON "appraisals"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written. Prisma schema cannot express these constraints.
-- See docs/data/schema-decisions.md, "Constraints not in schema.prisma".
-- ---------------------------------------------------------------------------

-- Case-insensitive unique names (contract: Org rule 2).
CREATE UNIQUE INDEX "departments_name_lower_key" ON "departments" (lower("name"));
CREATE UNIQUE INDEX "positions_name_lower_key" ON "positions" (lower("name"));

-- Usernames are stored normalised (Better Auth username plugin lower-cases them),
-- so the plain unique index on "username" is case-insensitive in effect.
ALTER TABLE "users" ADD CONSTRAINT "users_username_lower_chk" CHECK ("username" = lower("username"));

-- Placeholder auth emails: "<username>@users.invalid" (RFC 2606 .invalid never routes).
-- The flag and the domain must agree, so the app can trust either one.
ALTER TABLE "users" ADD CONSTRAINT "users_email_placeholder_chk"
  CHECK ("email_is_placeholder" = (lower("email") LIKE '%@users.invalid'));

-- Date ranges and rating range.
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_dates_chk"
  CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date");
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_dates_chk"
  CHECK ("project_start" IS NULL OR "project_end" IS NULL OR "project_end" >= "project_start");
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_rating_chk"
  CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

-- Soft delete: terminated_at is set if and only if employment_status = 'TERMINATED'.
ALTER TABLE "employees" ADD CONSTRAINT "employees_terminated_chk"
  CHECK (("employment_status" = 'TERMINATED') = ("terminated_at" IS NOT NULL));
