-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'HR', 'STAFF');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE');
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone_number" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "department" TEXT,
    "job_title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "profile_image_url" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "shift_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clock_in" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clock_out" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "session_status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "hours_worked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "check_in_ip" TEXT,
    "check_in_lat" DOUBLE PRECISION,
    "check_in_lng" DOUBLE PRECISION,
    "remarks" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_employee_code_idx" ON "users"("employee_code");
CREATE INDEX "users_department_idx" ON "users"("department");
CREATE INDEX "users_is_active_idx" ON "users"("is_active");
CREATE INDEX "attendances_user_id_idx" ON "attendances"("user_id");
CREATE INDEX "attendances_date_idx" ON "attendances"("date");
CREATE INDEX "attendances_session_status_idx" ON "attendances"("session_status");
CREATE INDEX "attendances_user_id_date_idx" ON "attendances"("user_id", "date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;