import bcrypt from "bcrypt";
import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";

// ── Account-creation helpers ─────────────────────────────────────────────────

const ADJECTIVES = ["amber","brave","calm","clever","swift","bright","bold","lucky","quiet","sunny","royal","noble","keen","warm","cool","eager","gentle","jolly","merry","witty","zesty","prime","vivid","crisp","snug","plucky","dapper","breezy","mellow","rapid"];
const NOUNS = ["tiger","river","falcon","maple","cedar","otter","comet","harbor","meadow","willow","ember","pebble","lantern","summit","breeze","canyon","beacon","garnet","quartz","sparrow","badger","marlin","cobra","walrus","pelican","heron","jaguar","panther","dolphin","raven"];

const generateTempPassword = () => {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${digits}`;
};

const generateEmployeeCode = async () => {
  const last = await prisma.user.findFirst({
    where: { employeeCode: { startsWith: "EMP-" } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });

  let next = 1;
  if (last?.employeeCode) {
    const n = parseInt(last.employeeCode.split("-")[1], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `EMP-${String(next).padStart(4, "0")}`;
};

// ── CRUD Controllers ──────────────────────────────────────────────────────────

export const getAllUsers = async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || "1") || 1;
  const limit = parseInt((req.query.limit as string) || "10") || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const department = req.query.department as string | undefined;
  const role = req.query.role as string | undefined;
  const isActive = (req.query.isActive as string) !== "false";

  try {
    const where: Record<string, unknown> = { isActive };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (department) where.department = department;
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          role: true,
          department: true,
          jobTitle: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Error fetching users",
        error: error.message,
      });
    }
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        department: true,
        jobTitle: true,
        isActive: true,
        mustChangePassword: true,
        shiftId: true,
        profileImageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, department, role, phoneNumber, jobTitle } = req.body;

    if (!firstName || !lastName || !email || !department) {
      res.status(400).json({
        success: false,
        message: "firstName, lastName, email and department are required.",
      });
      return;
    }

    const employeeCode = await generateEmployeeCode();
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        department: department.trim(),
        role: role || "STAFF",
        employeeCode,
        password: hashedPassword,
        mustChangePassword: true,
        phoneNumber: phoneNumber?.trim(),
        jobTitle: jobTitle?.trim(),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        department: true,
        jobTitle: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: newUser,
      tempPassword,
    });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "That email is already taken.",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updates = req.body;

    // Prevent sensitive field updates
    delete updates.employeeCode;
    delete updates.password;
    delete updates.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        department: true,
        jobTitle: true,
        isActive: true,
        mustChangePassword: true,
        shiftId: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error) {
      const prismaError = error as Error & { code?: string };
      if (prismaError.code === "P2025") {
        res.status(404).json({ message: "User not found!" });
        return;
      }
      res.status(500).json({
        message: "Update failed",
        error: error.message,
      });
    }
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (!user.isActive) {
      res.status(400).json({
        success: false,
        message: "User already deactivated",
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Delete failed",
        error: error.message,
      });
    }
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid current password",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: "Change password failed",
        error: error.message,
      });
    }
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
};