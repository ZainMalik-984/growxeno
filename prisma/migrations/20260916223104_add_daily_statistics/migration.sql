-- DropIndex
DROP INDEX "order_item_links_normalized_url_trgm_idx";

-- CreateTable
CREATE TABLE "daily_stats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenue_currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_stats_stat_date_idx" ON "daily_stats"("stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_user_id_stat_date_key" ON "daily_stats"("user_id", "stat_date");

-- AddForeignKey
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
