import { z } from "zod";

export const loginSchema = {
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
};

export const createUserSchema = {
  body: z.object({
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    email: z.string().email("Invalid email format"),
    department: z.string().min(1, "Department is required").max(100),
    role: z.enum(["STAFF", "HR", "SUPERADMIN"]).optional(),
    phoneNumber: z.string().max(20).optional(),
    jobTitle: z.string().max(100).optional(),
    shiftId: z.string().uuid().optional(),
  }),
};

export const updateUserSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    email: z.string().email().optional(),
    department: z.string().max(100).optional(),
    role: z.enum(["STAFF", "HR", "SUPERADMIN"]).optional(),
    phoneNumber: z.string().max(20).optional(),
    jobTitle: z.string().max(100).optional(),
    shiftId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
};

export const getUserByIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
};

export const deleteUserSchema = {
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
};

export const getUsersQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    department: z.string().optional(),
    role: z.enum(["STAFF", "HR", "SUPERADMIN"]).optional(),
    isActive: z.coerce.boolean().optional(),
  }),
};

export const clockInSchema = {
  body: z.object({
    checkInIp: z.string().ip().optional(),
    checkInLat: z.number().min(-90).max(90).optional(),
    checkInLng: z.number().min(-180).max(180).optional(),
    remarks: z.string().max(500).optional(),
  }),
};

export const clockOutSchema = {
  body: z.object({
    remarks: z.string().max(500).optional(),
  }),
};

export const getMyAttendanceSchema = {
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const getAllAttendanceSchema = {
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    userId: z.string().uuid().optional(),
    department: z.string().optional(),
    sessionStatus: z.enum(["OPEN", "CLOSED"]).optional(),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
};

export const attendanceIdSchema = {
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
};

export const dismissAlertSchema = {
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
};