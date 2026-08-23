CREATE TABLE "CreatorFunnelEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "workType" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CreatorFunnelEvent_sessionId_event_workType_key"
ON "CreatorFunnelEvent"("sessionId", "event", "workType");

CREATE INDEX "CreatorFunnelEvent_event_createdAt_idx"
ON "CreatorFunnelEvent"("event", "createdAt");

CREATE INDEX "CreatorFunnelEvent_createdAt_idx"
ON "CreatorFunnelEvent"("createdAt");
