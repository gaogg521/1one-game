-- Provider-level usage ledger. No prompt, source text, credentials, or raw response is persisted.
CREATE TABLE "ProviderUsageEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "modality" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "outputUnits" INTEGER,
  "estimatedCostMicros" INTEGER,
  "errorCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProviderUsageEvent_createdAt_idx" ON "ProviderUsageEvent"("createdAt");
CREATE INDEX "ProviderUsageEvent_provider_model_createdAt_idx" ON "ProviderUsageEvent"("provider", "model", "createdAt");
CREATE INDEX "ProviderUsageEvent_modality_status_createdAt_idx" ON "ProviderUsageEvent"("modality", "status", "createdAt");
