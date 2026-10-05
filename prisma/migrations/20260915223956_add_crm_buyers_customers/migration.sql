-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "PartyType" NOT NULL DEFAULT 'COMPANY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email" VARCHAR(320),
    "whatsapp_number" VARCHAR(32),
    "pricing_tier_id" UUID,
    "credit_limit" DECIMAL(14,2),
    "credit_limit_currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_contacts" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "title" VARCHAR(120),
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "whatsapp_number" VARCHAR(32),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buyer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "PartyType" NOT NULL DEFAULT 'INDIVIDUAL',
    "buyer_id" UUID,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_name_key" ON "pricing_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_slug_key" ON "pricing_tiers"("slug");

-- CreateIndex
CREATE INDEX "buyers_is_active_idx" ON "buyers"("is_active");

-- CreateIndex
CREATE INDEX "buyers_name_idx" ON "buyers"("name");

-- CreateIndex
CREATE INDEX "buyer_contacts_buyer_id_idx" ON "buyer_contacts"("buyer_id");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_buyer_id_idx" ON "customers"("buyer_id");

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "pricing_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_contacts" ADD CONSTRAINT "buyer_contacts_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
