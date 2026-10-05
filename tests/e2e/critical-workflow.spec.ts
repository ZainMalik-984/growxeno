import { test } from "@playwright/test";

/**
 * The critical end-to-end workflow from specification Section 124.
 *
 * THIS SUITE IS SKIPPED AND CONTAINS NO ASSERTIONS YET. It is a placeholder
 * recording the required coverage so it cannot be quietly forgotten — it is not
 * evidence of anything, and it must never be reported as a passing check.
 *
 * It cannot be written yet for two independent reasons:
 *   1. Buyers, Customers, Orders and Order Items do not exist before Phase 4.
 *   2. It needs a migrated, seeded database and a configured Supabase project.
 *
 * Required steps, to be implemented as their phases land. NOTE: "Create Buyer"
 * is the original specification's step (Section 124) — Buyer was removed
 * from the system entirely, post-Phase-10 (2026-09-27, owner-directed; see
 * prisma/schema/crm.prisma's file header), so no implementation of this
 * suite should include it.
 *
 *   Login                              (Phase 1 — implemented)
 *   -> Create Buyer                    (Phase 2, REMOVED post-Phase-10)
 *   -> Create Customer                 (Phase 2)
 *   -> Create Order                    (Phase 4)
 *   -> Add Order Items                 (Phase 4)
 *   -> Add Order Item Links            (Phase 4)
 *   -> Assign Worker                   (Phase 4)
 *   -> Process Order                   (Phase 4)
 *   -> Worker opens assigned work      (Phase 5)
 *   -> Worker starts work              (Phase 5)
 *   -> Worker updates item             (Phase 5)
 *   -> Worker marks item complete      (Phase 5)
 *   -> Admin reviews                   (Phase 5)
 *   -> Order completes                 (Phase 4/5)
 *
 * Also required by Section 124, tracked in docs/REQUIREMENTS.md:
 * permission restrictions, direct ALLOW, direct DENY, multiple roles, search by
 * order id / buyer / customer / worker / Order Item URL, multi-filter
 * combinations, daily statistics, payment workflows, notifications.
 */
test.describe.skip("critical workflow (Section 124) — not implemented before Phase 4", () => {
  test("login to order completion", () => {
    throw new Error("Not implemented. See the comment above.");
  });
});
