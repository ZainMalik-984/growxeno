-- Prisma's diff wants to drop "order_item_links_normalized_url_trgm_idx"
-- here — it cannot represent a pg_trgm GIN index in the schema DSL, so it
-- treats the hand-added index (see 20260916025241_add_orders) as "extra."
-- Deliberately NOT dropping it. See docs/DEVELOPMENT.md's Gotchas.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivered_at" TIMESTAMPTZ(6),
ADD COLUMN     "refunded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "category_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "order_id" UUID,
    "paid_by_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_payments" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "payment_date" DATE NOT NULL,
    "reference" VARCHAR(160),
    "method" VARCHAR(60),
    "notes" TEXT,
    "order_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buyer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_payments" (
    "id" UUID NOT NULL,
    "worker_id" UUID,
    "outsourced_worker_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "payment_date" DATE NOT NULL,
    "reference" VARCHAR(160),
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "worker_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_slug_key" ON "expense_categories"("slug");

-- CreateIndex
CREATE INDEX "expense_categories_is_active_idx" ON "expense_categories"("is_active");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_order_id_idx" ON "expenses"("order_id");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "buyer_payments_buyer_id_idx" ON "buyer_payments"("buyer_id");

-- CreateIndex
CREATE INDEX "buyer_payments_order_id_idx" ON "buyer_payments"("order_id");

-- CreateIndex
CREATE INDEX "buyer_payments_payment_date_idx" ON "buyer_payments"("payment_date");

-- CreateIndex
CREATE INDEX "worker_payments_worker_id_idx" ON "worker_payments"("worker_id");

-- CreateIndex
CREATE INDEX "worker_payments_outsourced_worker_id_idx" ON "worker_payments"("outsourced_worker_id");

-- CreateIndex
CREATE INDEX "worker_payments_payment_date_idx" ON "worker_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_payments" ADD CONSTRAINT "worker_payments_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_payments" ADD CONSTRAINT "worker_payments_outsourced_worker_id_fkey" FOREIGN KEY ("outsourced_worker_id") REFERENCES "outsourced_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_payments" ADD CONSTRAINT "worker_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
