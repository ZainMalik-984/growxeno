-- ---------------------------------------------------------------------------
-- Remove the pricing-tier concept from Phase 2, and add the Phase 3 catalog
-- (Category, Service, BuyerPricing).
--
-- The pricing-tier model (introduced in 20260915223956_add_crm_buyers_customers)
-- was removed at the owner's explicit direction before anything depended on
-- it: pricing is base price vs. a direct per-buyer override, with nothing in
-- between. The six seeded tier rows carried no other data (no orders or
-- payments reference them yet), so dropping the table loses nothing that
-- matters. See the note at the top of prisma/schema/crm.prisma.
-- ---------------------------------------------------------------------------

-- DropForeignKey
ALTER TABLE "buyers" DROP CONSTRAINT "buyers_pricing_tier_id_fkey";

-- AlterTable
ALTER TABLE "buyers" DROP COLUMN "pricing_tier_id";

-- DropTable
DROP TABLE "pricing_tiers";

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_pricing" (
    "buyer_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buyer_pricing_pkey" PRIMARY KEY ("buyer_id","service_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE INDEX "services_name_idx" ON "services"("name");

-- CreateIndex
CREATE INDEX "services_is_active_idx" ON "services"("is_active");

-- CreateIndex
CREATE INDEX "buyer_pricing_service_id_idx" ON "buyer_pricing"("service_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_pricing" ADD CONSTRAINT "buyer_pricing_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_pricing" ADD CONSTRAINT "buyer_pricing_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
