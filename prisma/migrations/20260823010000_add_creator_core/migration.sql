-- CreateTable
CREATE TABLE "CreativeProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "legacyType" TEXT,
    "legacyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreativeRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creativeProjectId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "parentRevisionId" TEXT,
    "cause" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preparing',
    "intentJson" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" DATETIME,
    CONSTRAINT "CreativeRevision_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "CreativeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creativeProjectId" TEXT NOT NULL,
    "creativeRevisionId" TEXT,
    "kind" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "contentJson" TEXT,
    "textContent" TEXT,
    "storageUri" TEXT,
    "contentHash" TEXT,
    "provider" TEXT,
    "sourceArtifactId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreativeArtifact_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "CreativeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeArtifact_creativeRevisionId_fkey" FOREIGN KEY ("creativeRevisionId") REFERENCES "CreativeRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creativeProjectId" TEXT NOT NULL,
    "creativeRevisionId" TEXT,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseExpiresAt" DATETIME,
    "workerId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorDetail" TEXT,
    "progressJson" TEXT,
    "outputArtifactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "GenerationJob_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "CreativeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GenerationJob_creativeRevisionId_fkey" FOREIGN KEY ("creativeRevisionId") REFERENCES "CreativeRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CreativeProject_ownerKey_updatedAt_idx" ON "CreativeProject"("ownerKey", "updatedAt");
CREATE INDEX "CreativeProject_kind_visibility_updatedAt_idx" ON "CreativeProject"("kind", "visibility", "updatedAt");
CREATE INDEX "CreativeProject_legacyType_legacyId_idx" ON "CreativeProject"("legacyType", "legacyId");
CREATE UNIQUE INDEX "CreativeRevision_creativeProjectId_sequence_key" ON "CreativeRevision"("creativeProjectId", "sequence");
CREATE INDEX "CreativeRevision_creativeProjectId_createdAt_idx" ON "CreativeRevision"("creativeProjectId", "createdAt");
CREATE INDEX "CreativeRevision_parentRevisionId_idx" ON "CreativeRevision"("parentRevisionId");
CREATE INDEX "CreativeArtifact_creativeProjectId_kind_createdAt_idx" ON "CreativeArtifact"("creativeProjectId", "kind", "createdAt");
CREATE INDEX "CreativeArtifact_creativeRevisionId_kind_idx" ON "CreativeArtifact"("creativeRevisionId", "kind");
CREATE INDEX "CreativeArtifact_contentHash_idx" ON "CreativeArtifact"("contentHash");
CREATE INDEX "CreativeArtifact_sourceArtifactId_idx" ON "CreativeArtifact"("sourceArtifactId");
CREATE UNIQUE INDEX "GenerationJob_idempotencyKey_key" ON "GenerationJob"("idempotencyKey");
CREATE INDEX "GenerationJob_status_runAfter_idx" ON "GenerationJob"("status", "runAfter");
CREATE INDEX "GenerationJob_creativeProjectId_createdAt_idx" ON "GenerationJob"("creativeProjectId", "createdAt");
CREATE INDEX "GenerationJob_creativeRevisionId_createdAt_idx" ON "GenerationJob"("creativeRevisionId", "createdAt");
CREATE INDEX "GenerationJob_leaseExpiresAt_idx" ON "GenerationJob"("leaseExpiresAt");
