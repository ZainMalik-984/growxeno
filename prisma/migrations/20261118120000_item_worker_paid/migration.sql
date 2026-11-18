-- An order item's worker pay can be marked as already paid (2026-11-18, owner request).
-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "worker_paid_at" TIMESTAMPTZ(6),
ADD COLUMN     "worker_paid_by_id" UUID;

