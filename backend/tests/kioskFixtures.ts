/**
 * Shared fixtures for the kiosk and QR suites.
 *
 * The device-lifecycle tests pair through the real `/api/kiosk/pair` route, but
 * the verification tests do not need to repeat that ceremony for every case.
 * They seed an already-paired terminal here instead, signing the same token
 * shape and storing the same keyed hash the pairing controller would have
 * written, so the kiosk middleware under test still sees a real row and a real
 * token. Seeding directly also keeps the public pairing route's 10-per-window
 * IP limiter out of the verification suite's way.
 *
 * Everything created here is deleted by the calling suite in `afterAll`.
 * Audit rows are append-only and deliberately left behind.
 */
import bcrypt from "bcrypt";
import { createHmac, randomBytes, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import { hashDeviceToken } from "../utils/kioskKeys.js";

const TAG_BYTES = 4;

/** A run-unique suffix, so two suites (or two runs) never collide on a name. */
export const uniqueTag = (): string =>
  `${Date.now()}${randomBytes(TAG_BYTES).toString("hex")}`;

export const hmacPin = (employeeId: string, pin: string, salt: string): string => {
  const key = process.env.PIN_HMAC_KEY;
  if (!key) throw new Error("PIN_HMAC_KEY must be set by tests/setup.ts");
  return createHmac("sha256", key).update(`${employeeId}${pin}${salt}`).digest("hex");
};

export const qrTokenHash = (token: string): string => {
  const key = process.env.QR_SECRET_KEY;
  if (!key) throw new Error("QR_SECRET_KEY must be set by tests/setup.ts");
  return createHmac("sha256", key).update(token).digest("hex");
};

export type TempStaff = {
  id: string;
  email: string;
  pin: string | null;
};

/**
 * A staff account outside the shared fixture trio, so a PIN lockout or a badge
 * revocation here cannot leak into another suite's assertions.
 */
export const createTempStaff = async (
  businessId: string,
  options: { isActive?: boolean; pin?: string } = {}
): Promise<TempStaff> => {
  const tag = uniqueTag();
  const password = await bcrypt.hash("unused-in-tests", 4);
  const pinSalt = options.pin ? randomBytes(16).toString("hex") : null;

  const user = await prisma.user.create({
    data: {
      businessId,
      employeeCode: `TMP-${tag}`,
      firstName: `Kiosk${tag.slice(-4)}`,
      lastName: "Tester",
      email: `kiosk.${tag}@test.attendpro.local`,
      password,
      role: "STAFF",
      isActive: options.isActive ?? true,
      mustChangePassword: false,
      pinSalt,
    },
    select: { id: true, email: true },
  });

  // The PIN hash is bound to the generated user id, which is only known after
  // the insert; write it with the real id rather than faking the join.
  if (options.pin && pinSalt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pinHash: hmacPin(user.id, options.pin, pinSalt), pinUpdatedAt: new Date() },
    });
  }

  return { id: user.id, email: user.email, pin: options.pin ?? null };
};

export type SeededKiosk = {
  id: string;
  token: string;
  publicId: string;
};

/**
 * An ACTIVE terminal plus a correctly signed device token, exactly as
 * `POST /api/kiosk/pair` would leave them.
 */
export const seedActiveKiosk = async (
  businessId: string,
  options: { label?: string; siteId?: string; tokenVersion?: number } = {}
): Promise<SeededKiosk> => {
  const tokenVersion = options.tokenVersion ?? 1;
  const id = randomUUID();
  const publicId = `KT-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;

  const token = jwt.sign(
    { kind: "kiosk", kioskId: id, businessId, tokenVersion },
    process.env.JWT_SECRET as string,
    { expiresIn: "30d" }
  );

  await prisma.kioskTerminal.create({
    data: {
      id,
      businessId,
      siteId: options.siteId ?? null,
      label: options.label ?? `Seeded kiosk ${uniqueTag()}`,
      publicId,
      state: "ACTIVE",
      tokenHash: hashDeviceToken(token),
      tokenVersion,
      tokenIssuedAt: new Date(),
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pairedAt: new Date(),
    },
  });

  return { id, token, publicId };
};

export type SeededBadge = {
  id: string;
  token: string;
};

/**
 * A QR credential row plus the opaque badge token that hashes to it. Used for
 * the identify flow; the QR-issue endpoint has its own dedicated tests.
 */
export const seedBadge = async (
  businessId: string,
  employeeId: string,
  options: { revoked?: boolean } = {}
): Promise<SeededBadge> => {
  const token = randomBytes(24).toString("base64url");
  const credential = await prisma.qrCredential.create({
    data: {
      businessId,
      employeeId,
      tokenHash: qrTokenHash(token),
      revokedAt: options.revoked ? new Date() : null,
    },
    select: { id: true },
  });
  return { id: credential.id, token };
};

/**
 * Remove every row a suite created, in FK-safe order.
 *
 * `attendance_attempts` is append-only (a database trigger refuses UPDATE and
 * DELETE), so any kiosk, employee or site an attempt points at cannot be
 * deleted or even have its foreign key nulled. Those rows are neutralised
 * instead — terminal revoked and token cleared, employee deactivated and PIN
 * cleared, site deactivated — while everything not pinned by attempt history
 * is deleted outright. Audit and attempt rows themselves always stay.
 */
export const cleanupKiosk = async (input: {
  kioskIds?: string[];
  employeeIds?: string[];
  siteIds?: string[];
}): Promise<void> => {
  const kioskIds = input.kioskIds ?? [];
  const employeeIds = input.employeeIds ?? [];
  const siteIds = input.siteIds ?? [];

  if (kioskIds.length || employeeIds.length) {
    await prisma.verificationSession.deleteMany({
      where: {
        OR: [
          ...(kioskIds.length ? [{ kioskId: { in: kioskIds } }] : []),
          ...(employeeIds.length ? [{ employeeId: { in: employeeIds } }] : []),
        ],
      },
    });
  }
  if (employeeIds.length) {
    await prisma.qrCredential.deleteMany({ where: { employeeId: { in: employeeIds } } });
  }

  if (kioskIds.length) {
    const pinned = await prisma.attendanceAttempt.findMany({
      where: { kioskId: { in: kioskIds } },
      select: { kioskId: true },
      distinct: ["kioskId"],
    });
    const pinnedIds = pinned.map((row) => row.kioskId as string);
    const freeIds = kioskIds.filter((id) => !pinnedIds.includes(id));

    if (freeIds.length) {
      await prisma.kioskTerminal.deleteMany({ where: { id: { in: freeIds } } });
    }
    if (pinnedIds.length) {
      await prisma.kioskTerminal.updateMany({
        where: { id: { in: pinnedIds } },
        data: {
          state: "REVOKED",
          tokenHash: null,
          pairingCodeHash: null,
          tokenVersion: { increment: 1 },
          revokedAt: new Date(),
        },
      });
    }
  }

  if (employeeIds.length) {
    const pinned = await prisma.attendanceAttempt.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true },
      distinct: ["employeeId"],
    });
    const pinnedIds = pinned.map((row) => row.employeeId as string);
    const freeIds = employeeIds.filter((id) => !pinnedIds.includes(id));

    if (freeIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: freeIds } } });
    }
    if (pinnedIds.length) {
      await prisma.user.updateMany({
        where: { id: { in: pinnedIds } },
        data: {
          isActive: false,
          pinHash: null,
          pinSalt: null,
          pinLockedUntil: null,
        },
      });
    }
  }

  if (siteIds.length) {
    const pinned = await prisma.attendanceAttempt.findMany({
      where: { siteId: { in: siteIds } },
      select: { siteId: true },
      distinct: ["siteId"],
    });
    const pinnedIds = pinned.map((row) => row.siteId as string);
    const freeIds = siteIds.filter((id) => !pinnedIds.includes(id));

    if (freeIds.length) {
      await prisma.kioskTerminal.updateMany({
        where: { siteId: { in: freeIds } },
        data: { siteId: null },
      });
      await prisma.site.deleteMany({ where: { id: { in: freeIds } } });
    }
    if (pinnedIds.length) {
      await prisma.site.updateMany({
        where: { id: { in: pinnedIds } },
        data: { isActive: false },
      });
    }
  }
};
