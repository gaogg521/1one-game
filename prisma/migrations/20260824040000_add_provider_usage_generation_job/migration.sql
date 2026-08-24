-- Correlates safe provider-usage metadata with durable GenerationJob execution.
-- No prompt, completion, credentials, or raw provider response is introduced.
ALTER TABLE "ProviderUsageEvent" ADD COLUMN "generationJobId" TEXT;
CREATE INDEX "ProviderUsageEvent_generationJobId_createdAt_idx" ON "ProviderUsageEvent"("generationJobId", "createdAt");
