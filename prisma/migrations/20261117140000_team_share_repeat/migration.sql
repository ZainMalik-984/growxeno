-- A team member can take several parts of one order item (2026-11-17, owner request).
-- DropIndex
DROP INDEX "team_shares_order_item_id_team_member_id_key";

-- CreateIndex
CREATE INDEX "team_shares_order_item_id_idx" ON "team_shares"("order_item_id");

