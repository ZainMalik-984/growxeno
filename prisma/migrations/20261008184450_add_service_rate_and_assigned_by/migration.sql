-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "assigned_by" UUID;

-- CreateTable
CREATE TABLE "service_rates" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "outsourced_worker_id" UUID NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_rates_service_id_outsourced_worker_id_key" ON "service_rates"("service_id", "outsourced_worker_id");

-- CreateIndex
CREATE INDEX "order_items_assigned_by_idx" ON "order_items"("assigned_by");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_rates" ADD CONSTRAINT "service_rates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_rates" ADD CONSTRAINT "service_rates_outsourced_worker_id_fkey" FOREIGN KEY ("outsourced_worker_id") REFERENCES "outsourced_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

