-- AlterTable
ALTER TABLE "Project" ADD COLUMN "shareCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareCode_key" ON "Project"("shareCode");
