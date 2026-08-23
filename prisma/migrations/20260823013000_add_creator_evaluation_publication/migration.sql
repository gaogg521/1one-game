-- CreateTable
CREATE TABLE "CreativeEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creativeProjectId" TEXT NOT NULL,
    "creativeRevisionId" TEXT,
    "evaluator" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "reportJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeEvaluation_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "CreativeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeEvaluation_creativeRevisionId_fkey" FOREIGN KEY ("creativeRevisionId") REFERENCES "CreativeRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativePublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creativeProjectId" TEXT NOT NULL,
    "creativeRevisionId" TEXT,
    "action" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "qualityVerdict" TEXT,
    "qualityScore" INTEGER,
    "reasonJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativePublication_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "CreativeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativePublication_creativeRevisionId_fkey" FOREIGN KEY ("creativeRevisionId") REFERENCES "CreativeRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CreativeEvaluation_creativeProjectId_createdAt_idx" ON "CreativeEvaluation"("creativeProjectId", "createdAt");
CREATE INDEX "CreativeEvaluation_creativeRevisionId_createdAt_idx" ON "CreativeEvaluation"("creativeRevisionId", "createdAt");
CREATE INDEX "CreativeEvaluation_verdict_createdAt_idx" ON "CreativeEvaluation"("verdict", "createdAt");
CREATE INDEX "CreativePublication_creativeProjectId_createdAt_idx" ON "CreativePublication"("creativeProjectId", "createdAt");
CREATE INDEX "CreativePublication_creativeRevisionId_createdAt_idx" ON "CreativePublication"("creativeRevisionId", "createdAt");
CREATE INDEX "CreativePublication_action_decision_createdAt_idx" ON "CreativePublication"("action", "decision", "createdAt");
