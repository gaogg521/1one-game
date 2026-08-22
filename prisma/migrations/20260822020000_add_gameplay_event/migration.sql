-- CreateTable
CREATE TABLE "GameplayEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "templateId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "elapsedMs" INTEGER,
    "score" INTEGER,
    "won" BOOLEAN,
    "verticalSliceScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GameplayEvent_projectId_createdAt_idx" ON "GameplayEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GameplayEvent_templateId_event_createdAt_idx" ON "GameplayEvent"("templateId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "GameplayEvent_sessionId_idx" ON "GameplayEvent"("sessionId");
