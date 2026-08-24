-- Safe provider reachability history: no credentials, prompts, or provider response bodies.
CREATE TABLE "RuntimeProviderProbe" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "statusCode" INTEGER,
  "outcome" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RuntimeProviderProbe_providerId_createdAt_idx" ON "RuntimeProviderProbe"("providerId", "createdAt");
CREATE INDEX "RuntimeProviderProbe_createdAt_idx" ON "RuntimeProviderProbe"("createdAt");
