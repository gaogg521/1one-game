-- The author-confirmed revision is deliberately a soft reference during the
-- legacy bridge. Old works can keep a null value until their owner publishes.
ALTER TABLE "CreativeProject" ADD COLUMN "acceptedRevisionId" TEXT;
CREATE INDEX "CreativeProject_acceptedRevisionId_idx" ON "CreativeProject"("acceptedRevisionId");
