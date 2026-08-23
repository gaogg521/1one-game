CREATE TABLE "LiteraryEngagementEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workType" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LiteraryEngagementEvent_workType_workId_sessionId_event_unitIndex_key"
ON "LiteraryEngagementEvent"("workType", "workId", "sessionId", "event", "unitIndex");

CREATE INDEX "LiteraryEngagementEvent_workType_workId_createdAt_idx"
ON "LiteraryEngagementEvent"("workType", "workId", "createdAt");

CREATE INDEX "LiteraryEngagementEvent_createdAt_idx"
ON "LiteraryEngagementEvent"("createdAt");
