-- CreateTable
CREATE TABLE "GenerationError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "promptSnippet" TEXT NOT NULL,
    "errorType" TEXT NOT NULL DEFAULT 'unknown',
    "errorMessage" TEXT,
    "ownerKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GenerationError_contentType_createdAt_idx" ON "GenerationError"("contentType", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationError_errorType_createdAt_idx" ON "GenerationError"("errorType", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationError_createdAt_idx" ON "GenerationError"("createdAt");
