import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, ownerFindUnique } = vi.hoisted(() => ({
  query: vi.fn(),
  ownerFindUnique: vi.fn(),
}));

vi.mock("../config/prismaClient.js", () => ({
  default: { $queryRaw: query },
  prismaUnscoped: { user: { findUnique: ownerFindUnique } },
}));

import { authenticateLookup } from "../utils/tenantLookup.js";

beforeEach(() => {
  query.mockReset();
  ownerFindUnique.mockReset();
});

describe("required authentication lookup", () => {
  it("returns null for a successful empty result without an owner lookup", async () => {
    query.mockResolvedValue([]);
    await expect(authenticateLookup("absent@example.invalid")).resolves.toBeNull();
    expect(ownerFindUnique).not.toHaveBeenCalled();
  });

  it("preserves the lookup result and parameterizes the identifier", async () => {
    const row = {
      id: "test-user", business_id: "test-business", password: "synthetic-value",
      role: "STAFF", is_active: true,
    };
    query.mockResolvedValue([row]);
    const email = "test@example.invalid";
    await expect(authenticateLookup(email)).resolves.toBe(row);
    const [sql, parameter] = query.mock.calls[0];
    expect(sql.join("?")).toContain("authenticate_lookup(?)");
    expect(parameter).toBe(email);
    expect(ownerFindUnique).not.toHaveBeenCalled();
  });

  it.each(["42883", "42501", "57014", "ECONNREFUSED"])(
    "propagates %s without escalating to the owner client",
    async (code) => {
      const failure = Object.assign(new Error("Synthetic lookup failure"), { code });
      query.mockRejectedValue(failure);
      await expect(authenticateLookup("test@example.invalid")).rejects.toBe(failure);
      expect(ownerFindUnique).not.toHaveBeenCalled();
    },
  );
});
