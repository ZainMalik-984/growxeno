-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "delivery_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "delivery_accepted_by_id" UUID;

-- Done items on orders the team already completed count as accepted.
UPDATE "order_items" oi
SET "delivery_accepted_at" = COALESCE(oi."finished_at", now())
FROM "orders" o
WHERE o."id" = oi."order_id"
  AND oi."status" = 'DONE'
  AND o."status" IN ('COMPLETED', 'DELIVERED', 'FINALIZED');
