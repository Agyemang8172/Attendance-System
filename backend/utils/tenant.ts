import prisma from "../config/prismaClient.js";

/**
 * Load the caller's business_id so every query in a tenant-scoped controller
 * runs inside one business. The schema makes business_id NOT NULL on every
 * user after migration 1, so a caller without a business is a configuration
 * problem, not a normal case.
 */
export const callerBusinessId = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return user?.businessId ?? null;
};
