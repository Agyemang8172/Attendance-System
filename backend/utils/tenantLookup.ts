import prisma from "../config/prismaClient.js";

/**
 * Pre-tenant authentication uses the required SECURITY DEFINER lookup.
 * Unexpected lookup errors propagate to the generic authentication error handler;
 * they must never substitute an owner-client query.
 */
export type AuthenticateLookupRow = {
  id: string;
  business_id: string;
  password: string;
  role: string;
  is_active: boolean;
};

export const authenticateLookup = async (
  email: string
): Promise<AuthenticateLookupRow | null> => {
  const rows = await prisma.$queryRaw<AuthenticateLookupRow[]>`
    SELECT id, business_id, password, role, is_active
    FROM authenticate_lookup(${email})
  `;
  return rows[0] ?? null;
};
