-- Hand-added data cleanup (not something `prisma migrate diff` generates,
-- since it's data, not schema): remove the now-dead permission catalog keys
-- so no role/user grant of them lingers as an orphaned, unreachable
-- permission. `role_permissions`/`user_permissions` both cascade-delete on
-- their `permission_id` FK, so this alone clears any grants of them too.
DELETE FROM "permissions" WHERE "key" IN (
  'buyers.view', 'buyers.create', 'buyers.edit', 'buyers.delete',
  'buyers.pricing.view', 'buyers.pricing.manage',
  'buyers.payments.view', 'buyers.payments.manage',
  'finance.buyer_payments.view', 'finance.buyer_payments.manage',
  'reports.buyers'
);

-- AlterEnum
--
-- Hand-patched (owner-directed simplification, confirmed directly
-- 2026-09-27: "currently there are only two sources for order Fiverr and
-- External"): the generated `USING ("source"::text::"OrderSource_new")` cast
-- would fail for any existing row whose source is one of the old
-- DIRECT/WHOLESALE/MANUAL/OTHER values, since none of those labels exist in
-- the new two-value enum. Backfilled instead from whether the order already
-- has a linked Fiverr account — the same rule the app enforces going
-- forward (fiverrAccountId set <=> source = FIVERR).
BEGIN;
CREATE TYPE "OrderSource_new" AS ENUM ('FIVERR', 'EXTERNAL');
ALTER TABLE "public"."orders" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "source" TYPE "OrderSource_new" USING (
  CASE
    WHEN "fiverr_account_id" IS NOT NULL THEN 'FIVERR'::"OrderSource_new"
    ELSE 'EXTERNAL'::"OrderSource_new"
  END
);
ALTER TYPE "OrderSource" RENAME TO "OrderSource_old";
ALTER TYPE "OrderSource_new" RENAME TO "OrderSource";
DROP TYPE "public"."OrderSource_old";
ALTER TABLE "orders" ALTER COLUMN "source" SET DEFAULT 'EXTERNAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "buyer_contacts" DROP CONSTRAINT "buyer_contacts_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "buyer_payments" DROP CONSTRAINT "buyer_payments_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "buyer_payments" DROP CONSTRAINT "buyer_payments_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "buyer_payments" DROP CONSTRAINT "buyer_payments_order_id_fkey";

-- DropForeignKey
ALTER TABLE "buyer_pricing" DROP CONSTRAINT "buyer_pricing_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "buyer_pricing" DROP CONSTRAINT "buyer_pricing_service_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_buyer_id_fkey";

-- DropIndex
DROP INDEX "customers_buyer_id_idx";

-- DropIndex
DROP INDEX "orders_buyer_id_idx";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "buyer_id";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "buyer_id",
ALTER COLUMN "source" SET DEFAULT 'EXTERNAL';

-- DropTable
DROP TABLE "buyer_contacts";

-- DropTable
DROP TABLE "buyer_payments";

-- DropTable
DROP TABLE "buyer_pricing";

-- DropTable
DROP TABLE "buyers";

