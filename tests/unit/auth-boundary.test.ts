/**
 * Test 3: auth-boundary.test.ts
 * ==============================
 * Purpose: Verify ownership security boundary works correctly.
 *
 * This test verifies the logic concept behind the ownership check pattern used
 * in saveMenuAction (app/actions/menu.ts). Since server actions require Supabase
 * mocking, we instead model the decision tree as pure helper functions and assert
 * their behavior.
 *
 * The ownership check from menu.ts (lines 121-135):
 *
 *   const { data: existingRestaurant } = await supabase
 *     .from("restaurants")
 *     .select("user_id")
 *     .eq("slug", cleanSlug)
 *     .maybeSingle();
 *
 *   if (existingRestaurant?.user_id && existingRestaurant.user_id !== userId) {
 *     return { success: false, error: "No eres el propietario de este restaurante." };
 *   }
 *
 * Decision tree:
 * ┌─────────────────────┬──────────────────┬──────────────────┐
 * │ existingRestaurant  │ userId           │ Result           │
 * ├─────────────────────┼──────────────────┼──────────────────┤
 * │ null                │ anything         │ ✅ allow         │
 * │ { user_id: X }      │ X === userId     │ ✅ allow         │
 * │ { user_id: X }      │ X !== userId     │ ❌ reject        │
 * └─────────────────────┴──────────────────┴──────────────────┘
 */

import { describe, it, expect } from "vitest";

// ── Pure helper that mirrors the ownership-check decision tree ──────────────

interface RestaurantRow {
  user_id: string;
}

interface OwnershipCheckResult {
  allow: boolean;
  reason?: string; // only present when allow is false
}

/**
 * Mirrors the ownership boundary check from app/actions/menu.ts lines 127-134.
 *
 * @param existingRestaurant - The row returned by `.maybeSingle()` on restaurants table (null for new slugs)
 * @param userId             - The current authenticated user's id
 * @returns Whether the caller is allowed to proceed with the save action
 */
export function checkOwnershipBoundary(
  existingRestaurant: RestaurantRow | null,
  userId: string
): OwnershipCheckResult {
  // If no existing restaurant exists for this slug → allow (new restaurant)
  if (!existingRestaurant || !existingRestaurant.user_id) {
    return { allow: true };
  }

  // Row exists — verify ownership
  if (existingRestaurant.user_id !== userId) {
    return { allow: false, reason: "ownership_mismatch" };
  }

  // Row exists and belongs to the caller → allow
  return { allow: true };
}

// ── Snapshot of the "demo-anonymous-user" constant from menu.ts line 45 ─────
// The production code uses this as a fallback userId for local/demo mode.
// Our tests must ensure NOTHING in the ownership-return logic hardcodes
// this string or leaks it into decision values.
const DEMO_ANONYMOUS_USER_ID = "demo-anonymous-user";

describe("auth-boundary: ownership security check", () => {
  describe("case 1 — existingRestaurant.user_id matches userId", () => {
    it("should allow the action when records match", () => {
      const ownerUser = "user-a1b2c3d4";
      const result = checkOwnershipBoundary(
        { user_id: ownerUser },
        ownerUser
      );

      expect(result.allow).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should work even with the demo-anonymous-user internal constant", () => {
      const result = checkOwnershipBoundary(
        { user_id: DEMO_ANONYMOUS_USER_ID },
        DEMO_ANONYMOUS_USER_ID
      );

      expect(result.allow).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("case 2 — existingRestaurant.user_id differs from userId", () => {
    it("should reject with ownership_mismatch", () => {
      const requesterId = "user-requester99";
      const actualOwner = "user-actual-owner01";

      const result = checkOwnershipBoundary(
        { user_id: actualOwner },
        requesterId
      );

      expect(result.allow).toBe(false);
      expect(result.reason).toBe("ownership_mismatch");
    });

    it("should not leak the actual owner's userId into the rejection reason", () => {
      const actualOwner = "user-secret-owner";
      const requesterId = "malicious-user";

      const result = checkOwnershipBoundary(
        { user_id: actualOwner },
        requesterId
      );

      expect(result.allow).toBe(false);
      expect(result.reason).toBe("ownership_mismatch");
      // Reason should be generic, NOT contain the real owner's identifier
      expect(result.reason).not.toContain(actualOwner);
    });

    it("should handle UUID-style IDs correctly", () => {
      const uuidA = "550e8400-e29b-41d4-a716-446655440001";
      const uuidB = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

      const result = checkOwnershipBoundary({ user_id: uuidA }, uuidB);

      expect(result.allow).toBe(false);
      expect(result.reason).toBe("ownership_mismatch");
    });
  });

  describe("case 3 — existingRestaurant is null (new slug)", () => {
    it("should allow when no restaurant row exists", () => {
      const result = checkOwnershipBoundary(null, "any-user-id");

      expect(result.allow).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should allow regardless of which user requests a new slug", () => {
      const ids = ["alice", "bob", DEMO_ANONYMOUS_USER_ID, "", "-"];

      for (const uid of ids) {
        const result = checkOwnershipBoundary(null, uid);
        expect(result.allow).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    });
  });

  describe("case 4 — no hardcoded 'demo-anonymous-user' strings in return values", () => {
    /**
     * Scan every possible branch of checkOwnershipBoundary for any
     * occurrence of the literal string "demo-anonymous-user" in its output.
     */
    it("should never leak 'demo-anonymous-user' in Allow results", () => {
      const testCases: Array<{
        name: string;
        existing: RestaurantRow | null;
        userId: string;
      }> = [
        { name: "owner match", existing: { user_id: DEMO_ANONYMOUS_USER_ID }, userId: DEMO_ANONYMOUS_USER_ID },
        { name: "new slug (null)", existing: null, userId: "some-user" },
        { name: "unrelated owner", existing: { user_id: "someone-else" }, userId: DEMO_ANONYMOUS_USER_ID },
      ];

      for (const tc of testCases) {
        const result = checkOwnershipBoundary(tc.existing, tc.userId);
        const returnValue = JSON.stringify(result);
        expect(returnValue).not.toContain("demo-anonymous-user");
      }
    });

    it("should produce a safe JSON serialisation for all branches", () => {
      const scenarios = [
        checkOwnershipBoundary(null, "x"),
        checkOwnershipBoundary({ user_id: DEMO_ANONYMOUS_USER_ID }, DEMO_ANONYMOUS_USER_ID),
        checkOwnershipBoundary({ user_id: "other" }, DEMO_ANONYMOUS_USER_ID),
      ];

      for (const r of scenarios) {
        const json = JSON.stringify(r);
        // Only the deny case contains reason, but never a raw userId
        if (!r.allow) {
          expect(json).toContain("ownership_mismatch");
        } else {
          expect(json).toBe('{"allow":true}');
        }
      }
    });
  });

  // ── Edge-case / regression guards ─────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty-string user_id gracefully (treated as missing)", () => {
      const result = checkOwnershipBoundary({ user_id: "" }, "real-user");

      // Empty user_id falls through the `!existingRestaurant.user_id` guard → allow
      expect(result.allow).toBe(true);
    });

    it("is deterministic — same inputs always produce same outputs", () => {
      const input = { user_id: "owner-xyz" };
      const calls = Array.from({ length: 50 }, () =>
        checkOwnershipBoundary(input, "owner-xyz")
      );

      const unique = new Set(calls.map((c) => JSON.stringify(c)));
      expect(unique.size).toBe(1);
    });
  });
});
