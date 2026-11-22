import { Request, Response } from "express";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";
import { callerBusinessId } from "../utils/tenant.js";

const siteSelect = {
  id: true,
  businessId: true,
  name: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

// ── List sites ───────────────────────────────────────────────────────

export const listSites = async (req: Request, res: Response): Promise<void> => {
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

    const { isActive } = req.query as { isActive?: string; page?: string; limit?: string };
    const where: Record<string, unknown> = { businessId };
    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const [sites, total] = await Promise.all([
      prisma.site.findMany({
        where,
        orderBy: { name: "asc" },
        select: siteSelect,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.site.count({ where }),
    ]);

    res.status(200).json({ success: true, data: sites, meta: { page, limit, total } });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Create site ──────────────────────────────────────────────────────

export const createSite = async (req: Request, res: Response): Promise<void> => {
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

    const { name, latitude, longitude, radiusMeters, isActive } = req.body as {
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      isActive?: boolean;
    };

    // Default radius comes from the business's live policy (contract: the
    // default follows the policy), falling back to the schema default.
    let radius = radiusMeters;
    if (radius === undefined) {
      const now = new Date();
      const policy = await prisma.workplacePolicy.findFirst({
        where: { businessId, isDefault: true },
        select: { versions: { where: { effectiveTo: null }, orderBy: { versionNumber: "desc" }, take: 1, select: { geoFenceRadiusMeters: true } } },
      });
      radius = policy?.versions[0]?.geoFenceRadiusMeters ?? 150;
    }

    const site = await prisma.site.create({
      data: {
        businessId,
        name,
        latitude,
        longitude,
        radiusMeters: radius,
        isActive: isActive ?? true,
      },
      select: siteSelect,
    });

    auditLog.siteCreated(caller.userId, site.id, businessId);
    res.status(201).json({ success: true, data: site });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "A site with that name already exists in this business.",
        });
        return;
      }
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Update site ──────────────────────────────────────────────────────

export const updateSite = async (req: Request, res: Response): Promise<void> => {
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

    const siteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, businessId: true },
    });
    if (!existing || existing.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Site not found" });
      return;
    }

    const { name, latitude, longitude, radiusMeters, isActive } = req.body as {
      name?: string;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (radiusMeters !== undefined) data.radiusMeters = radiusMeters;
    if (isActive !== undefined) data.isActive = isActive;

    const site = await prisma.site.update({
      where: { id: siteId },
      data,
      select: siteSelect,
    });

    auditLog.siteUpdated(caller.userId, site.id, businessId);
    res.status(200).json({ success: true, data: site });
  } catch (error) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "A site with that name already exists in this business.",
        });
        return;
      }
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── Deactivate site ──────────────────────────────────────────────────

// Never delete a site — deactivate only. Kiosks and past attendance attempts
// keep their site_id; a hard delete would orphan them.
export const deactivateSite = async (req: Request, res: Response): Promise<void> => {
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

    const siteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, businessId: true, isActive: true },
    });
    if (!existing || existing.businessId !== businessId) {
      res.status(404).json({ success: false, message: "Site not found" });
      return;
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: { isActive: false },
      select: siteSelect,
    });

    auditLog.siteDeactivated(caller.userId, site.id, businessId);
    res.status(200).json({ success: true, message: "Site deactivated", data: site });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

export default {
  listSites,
  createSite,
  updateSite,
  deactivateSite,
};
