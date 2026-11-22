import jwt from "jsonwebtoken";

/**
 * Access-token lifetime. Long enough for a working day, short enough that a
 * copied token does not live forever. Revocation does not wait for expiry:
 * every request compares this claim against the account row.
 */
export const ACCESS_TOKEN_TTL = "8h";

export interface AccessTokenUser {
  id: string;
  role: string;
  tokenVersion: number;
  /**
   * The tenant is claimed so the request can open its RLS transaction before
   * the account row has been read. The claim is signed; `authMiddleware` also
   * compares it with the row it loads.
   */
  businessId: string;
}

/**
 * Sign an access token carrying the account's current token version.
 *
 * The version is what makes a password change, an admin reset, a role change
 * or a deactivation end existing sessions. `authMiddleware` compares the claim
 * with the database row on every request.
 */
export function signAccessToken(user: AccessTokenUser): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      businessId: user.businessId,
    },
    secret,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}
