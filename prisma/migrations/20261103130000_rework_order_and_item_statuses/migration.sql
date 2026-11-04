-- Order and item status rework (2026-11-03, owner request).
-- See the OrderStatus / OrderItemStatus doc comments in prisma/schema/orders.prisma.

-- Items: PENDING, PROCESSING, DONE, REFILL, CANCELLED --------------------------
ALTER TYPE "OrderItemStatus" RENAME TO "OrderItemStatus_old";
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'REFILL', 'CANCELLED');

-- Internal Review meant "the worker has finished", which is now Done.
UPDATE "order_items" SET "finished_at" = COALESCE("finished_at", "updated_at") WHERE "status" = 'INTERNAL_REVIEW';

ALTER TABLE "order_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "order_items" ALTER COLUMN "status" TYPE "OrderItemStatus" USING (
    CASE "status"::text
        WHEN 'PENDING' THEN 'PENDING'
        WHEN 'ASSIGNED' THEN 'PROCESSING'
        WHEN 'IN_PROGRESS' THEN 'PROCESSING'
        WHEN 'PAUSED' THEN 'PROCESSING'
        WHEN 'INTERNAL_REVIEW' THEN 'DONE'
        WHEN 'COMPLETED' THEN 'DONE'
        WHEN 'REVISION' THEN 'REFILL'
        ELSE 'CANCELLED'
    END
)::"OrderItemStatus";
ALTER TABLE "order_items" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "OrderItemStatus_old";

-- When the current worker was assigned. Best available value for existing rows.
ALTER TABLE "order_items" ADD COLUMN "assigned_at" TIMESTAMPTZ(6);
UPDATE "order_items" SET "assigned_at" = "updated_at"
WHERE "outsourced_worker_id" IS NOT NULL OR "worker_id" IS NOT NULL;

-- Orders --------------------------------------------------------------------
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM (
    'PENDING', 'ASSIGNED', 'PROCESSING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'DELIVERED', 'FINALIZED', 'CANCELLED'
);

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus" USING (
    CASE "status"::text
        WHEN 'DELIVERED' THEN 'DELIVERED'
        WHEN 'COMPLETED' THEN 'FINALIZED'   -- the old final state
        WHEN 'CANCELLED' THEN 'CANCELLED'
        ELSE 'PENDING'                      -- recalculated from items below
    END
)::"OrderStatus";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "OrderStatus_old";

-- A refunded order is now the combined "Refunded / Cancelled" status.
UPDATE "orders" SET "status" = 'CANCELLED' WHERE "refunded" = true;

-- Calculated statuses, same rule as deriveOrderStatus() in state-machine.ts.
WITH agg AS (
    SELECT o."id",
        COUNT(i."id") FILTER (WHERE i."status" <> 'CANCELLED') AS active,
        COUNT(i."id") FILTER (WHERE i."status" = 'DONE') AS done,
        COUNT(i."id") FILTER (WHERE i."status" IN ('PROCESSING', 'REFILL')) AS accepted,
        COUNT(i."id") FILTER (
            WHERE i."status" <> 'CANCELLED' AND (i."outsourced_worker_id" IS NOT NULL OR i."worker_id" IS NOT NULL)
        ) AS assigned
    FROM "orders" o
    LEFT JOIN "order_items" i ON i."order_id" = o."id"
    GROUP BY o."id"
)
UPDATE "orders" AS o
SET "status" = (CASE
        WHEN agg.active = 0 THEN 'PENDING'
        WHEN agg.done = agg.active THEN 'COMPLETED'
        WHEN agg.done > 0 THEN 'PARTIALLY_COMPLETED'
        WHEN agg.accepted = agg.active THEN 'PROCESSING'
        WHEN agg.assigned = agg.active THEN 'ASSIGNED'
        ELSE 'PENDING'
    END)::"OrderStatus"
FROM agg
WHERE o."id" = agg."id" AND o."status" NOT IN ('DELIVERED', 'FINALIZED', 'CANCELLED');
