-- AlterTable
ALTER TABLE "outsourced_workers" ADD COLUMN     "user_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "outsourced_workers_user_id_key" ON "outsourced_workers"("user_id");

-- AddForeignKey
ALTER TABLE "outsourced_workers" ADD CONSTRAINT "outsourced_workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

