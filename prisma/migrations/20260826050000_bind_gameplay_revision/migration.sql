-- Bind anonymous gameplay evidence to the exact immutable revision rendered.
ALTER TABLE "GameplayEvent" ADD COLUMN "creativeRevisionId" TEXT;
ALTER TABLE "GameplayEvent" ADD COLUMN "eventKey" TEXT;
ALTER TABLE "CreativeArtifact" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "GameplayEvent_eventKey_key" ON "GameplayEvent"("eventKey");
CREATE INDEX "GameplayEvent_creativeRevisionId_createdAt_idx" ON "GameplayEvent"("creativeRevisionId", "createdAt");
CREATE UNIQUE INDEX "CreativeArtifact_idempotencyKey_key" ON "CreativeArtifact"("idempotencyKey");
