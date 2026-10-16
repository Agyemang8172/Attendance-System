import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";

/**
 * Load the caller's business_id so every policy query is scoped to one tenant.
 */
const callerBusinessId = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return user?.businessId ?? null;
};

const policySelect = {
  id: true,
  businessId: true,
  shiftId: true,
  name: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
};

// ── List policies ────────────────────────────────────────────────────

export const listPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const policies = await prisma.workplacePolicy.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        ...policySelect,
        shift: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            businessId: true,
            policyId: true,
            versionNumber: true,
            effectiveFrom: true,
            effectiveTo: true,
            graceEarlyMinutes: true,
            graceLateMinutes: true,
            earlyThresholdMinutes: true,
            autoClockOutEnabled: true,
            autoClockOutBufferMinutes: true,
            autoClockOutMaxOpenMinutes: true,
            correctionWindowDays: true,
            geoFenceRadiusMeters: true,
            locationAccuracyThresholdMeters: true,
            gpsFreshnessSeconds: true,
            observePublicHolidays: true,
            createdAt: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, data: policies });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

// ── Create policy (with version 1) ───────────────────────────────────

export const createPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const {
      name,
      shiftId,
      graceEarlyMinutes,
      graceLateMinutes,
      earlyThresholdMinutes,
      autoClockOutEnabled,
      autoClockOutBufferMinutes,
      autoClockOutMaxOpenMinutes,
      correctionWindowDays,
      geoFenceRadiusMeters,
      locationAccuracyThresholdMeters,
      gpsFreshnessSeconds,
      observePublicHolidays,
      effectiveFrom,
    } = req.body as {
      name: string;
      shiftId?: string;
      graceEarlyMinutes?: number;
      graceLateMinutes?: number;
      earlyThresholdMinutes?: number;
      autoClockOutEnabled?: boolean;
      autoClockOutBufferMinutes?: number;
      autoClockOutMaxOpenMinutes?: number;
      correctionWindowDays?: number;
      geoFenceRadiusMeters?: number;
      locationAccuracyThresholdMeters?: number;
      gpsFreshnessSeconds?: number;
      observePublicHolidays?: boolean;
      effectiveFrom: string;
    };

    const effectiveFromDate = new Date(effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      res.status(400).json({ success: false, message: "Invalid effective from date" });
      return;
    }

    // First policy for the business is the default.
    const existingCount = await prisma.workplacePolicy.count({ where: { businessId } });

    const result = await prisma.$transaction(async (tx) => {
      const policy = await tx.workplacePolicy.create({
        data: {
          businessId,
          name,
          shiftId,
          isDefault: existingCount === 0,
        },
        select: policySelect,
      });

      const version = await tx.policyVersion.create({
        data: {
          businessId,
          policyId: policy.id,
          versionNumber: 1,
          effectiveFrom: effectiveFromDate,
          graceEarlyMinutes: graceEarlyMinutes ?? 0,
          graceLateMinutes: graceLateMinutes ?? 0,
          earlyThresholdMinutes: earlyThresholdMinutes ?? 0,
          autoClockOutEnabled: autoClockOutEnabled ?? false,
          autoClockOutBufferMinutes: autoClockOutBufferMinutes ?? 120,
          autoClockOutMaxOpenMinutes: autoClockOutMaxOpenMinutes ?? 840,
          correctionWindowDays: correctionWindowDays ?? 7,
          geoFenceRadiusMeters: geoFenceRadiusMeters ?? 150,
          locationAccuracyThresholdMeters: locationAccuracyThresholdMeters ?? 50,
          gpsFreshnessSeconds: gpsFreshnessSeconds ?? 60,
          observePublicHolidays: observePublicHolidays ?? false,
          createdByUserId: caller.userId,
        },
        select: {
          id: true,
          versionNumber: true,
          effectiveFrom: true,
        },
      });

      return { policy, version };
    });

    auditLog.policyCreated?.(caller.userId, result.policy.id, businessId);
    res.status(201).json({ success: true, data: { policy: result.policy, version: result.version } });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "A policy with that name already exists in this business.",
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

// ── Create a new policy version ──────────────────────────────────────

export const createPolicyVersion = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const policyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const {
      graceEarlyMinutes,
      graceLateMinutes,
      earlyThresholdMinutes,
      autoClockOutEnabled,
      autoClockOutBufferMinutes,
      autoClockOutMaxOpenMinutes,
      correctionWindowDays,
      geoFenceRadiusMeters,
      locationAccuracyThresholdMeters,
      gpsFreshnessSeconds,
      observePublicHolidays,
      effectiveFrom,
    } = req.body as {
      graceEarlyMinutes?: number;
      graceLateMinutes?: number;
      earlyThresholdMinutes?: number;
      autoClockOutEnabled?: boolean;
      autoClockOutBufferMinutes?: number;
      autoClockOutMaxOpenMinutes?: number;
      correctionWindowDays?: number;
      geoFenceRadiusMeters?: number;
      locationAccuracyThresholdMeters?: number;
      gpsFreshnessSeconds?: number;
      observePublicHolidays?: boolean;
      effectiveFrom: string;
    };

    const effectiveFromDate = new Date(effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      res.status(400).json({ success: false, message: "Invalid effective from date" });
      return;
    }

    // Validate outside the transaction: policy must exist in this tenant, a
    // current (open) version must exist, and the new effective date must be
    // after the current version's start.
    const policy = await prisma.workplacePolicy.findUnique({
      where: { id: policyId },
      select: { id: true, businessId: true },
    });
    if (!policy || policy.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Policy not found" });
      return;
    }

    const current = await prisma.policyVersion.findFirst({
      where: { policyId, effectiveTo: null },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, effectiveFrom: true },
    });
    if (!current) {
      res.status(400).json({ success: false, message: "No current policy version" });
      return;
    }

    if (effectiveFromDate <= current.effectiveFrom) {
      res.status(400).json({
        success: false,
        message: "Effective from must be after the current version's start date",
      });
      return;
    }

    const version = await prisma.$transaction(async (tx) => {
      // Close the current version.
      await tx.policyVersion.update({
        where: { id: current.id },
        data: { effectiveTo: effectiveFromDate },
      });

      return tx.policyVersion.create({
        data: {
          businessId,
          policyId,
          versionNumber: current.versionNumber + 1,
          effectiveFrom: effectiveFromDate,
          graceEarlyMinutes: graceEarlyMinutes ?? 0,
          graceLateMinutes: graceLateMinutes ?? 0,
          earlyThresholdMinutes: earlyThresholdMinutes ?? 0,
          autoClockOutEnabled: autoClockOutEnabled ?? false,
          autoClockOutBufferMinutes: autoClockOutBufferMinutes ?? 120,
          autoClockOutMaxOpenMinutes: autoClockOutMaxOpenMinutes ?? 840,
          correctionWindowDays: correctionWindowDays ?? 7,
          geoFenceRadiusMeters: geoFenceRadiusMeters ?? 150,
          locationAccuracyThresholdMeters: locationAccuracyThresholdMeters ?? 50,
          gpsFreshnessSeconds: gpsFreshnessSeconds ?? 60,
          observePublicHolidays: observePublicHolidays ?? false,
          createdByUserId: caller.userId,
        },
        select: {
          id: true,
          versionNumber: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });
    });

    auditLog.policyVersionCreated?.(caller.userId, version.id, businessId);
    res.status(201).json({ success: true, data: { policy: policyId, version } });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
};

export default {
  listPolicies,
  createPolicy,
  createPolicyVersion,
};
