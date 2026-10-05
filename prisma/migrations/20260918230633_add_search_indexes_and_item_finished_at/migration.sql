-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "finished_at" TIMESTAMPTZ(6);

-- Hand-added backfill: items already COMPLETED/CANCELLED get their last-updated time as the
-- best available finish time (the only timestamp that existed before this column).
UPDATE "order_items" SET "finished_at" = "updated_at" WHERE "status" IN ('COMPLETED', 'CANCELLED');

-- CreateIndex
CREATE INDEX "buyer_contacts_name_trgm_idx" ON "buyer_contacts" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "buyer_contacts_email_trgm_idx" ON "buyer_contacts" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "buyer_contacts_phone_trgm_idx" ON "buyer_contacts" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "buyers_name_trgm_idx" ON "buyers" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "buyers_email_trgm_idx" ON "buyers" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "buyers_whatsapp_number_trgm_idx" ON "buyers" USING GIN ("whatsapp_number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "customers_name_trgm_idx" ON "customers" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "customers_email_trgm_idx" ON "customers" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "customers_phone_trgm_idx" ON "customers" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "order_items_status_finished_at_idx" ON "order_items"("status", "finished_at");

-- CreateIndex
CREATE INDEX "orders_external_reference_trgm_idx" ON "orders" USING GIN ("external_reference" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "outsourced_workers_name_trgm_idx" ON "outsourced_workers" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "outsourced_workers_phone_trgm_idx" ON "outsourced_workers" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "services_name_trgm_idx" ON "services" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_full_name_trgm_idx" ON "users" USING GIN ("full_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_phone_trgm_idx" ON "users" USING GIN ("phone" gin_trgm_ops);
