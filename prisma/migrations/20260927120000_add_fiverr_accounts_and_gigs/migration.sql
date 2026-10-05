-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fiverr_account_id" UUID;

-- CreateTable
CREATE TABLE "fiverr_accounts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320),
    "paypal_email" VARCHAR(320),
    "paypal_password_encrypted" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fiverr_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiverr_gigs" (
    "id" UUID NOT NULL,
    "fiverr_account_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fiverr_gigs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiverr_gig_stats" (
    "id" UUID NOT NULL,
    "gig_id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fiverr_gig_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiverr_accounts_is_active_idx" ON "fiverr_accounts"("is_active");

-- CreateIndex
CREATE INDEX "fiverr_accounts_name_idx" ON "fiverr_accounts"("name");

-- CreateIndex
CREATE INDEX "fiverr_accounts_name_trgm_idx" ON "fiverr_accounts" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "fiverr_gigs_fiverr_account_id_idx" ON "fiverr_gigs"("fiverr_account_id");

-- CreateIndex
CREATE INDEX "fiverr_gigs_name_trgm_idx" ON "fiverr_gigs" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "fiverr_gig_stats_gig_id_stat_date_idx" ON "fiverr_gig_stats"("gig_id", "stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "fiverr_gig_stats_gig_id_stat_date_key" ON "fiverr_gig_stats"("gig_id", "stat_date");

-- CreateIndex
CREATE INDEX "orders_fiverr_account_id_idx" ON "orders"("fiverr_account_id");

-- AddForeignKey
ALTER TABLE "fiverr_gigs" ADD CONSTRAINT "fiverr_gigs_fiverr_account_id_fkey" FOREIGN KEY ("fiverr_account_id") REFERENCES "fiverr_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiverr_gig_stats" ADD CONSTRAINT "fiverr_gig_stats_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "fiverr_gigs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiverr_gig_stats" ADD CONSTRAINT "fiverr_gig_stats_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_fiverr_account_id_fkey" FOREIGN KEY ("fiverr_account_id") REFERENCES "fiverr_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

