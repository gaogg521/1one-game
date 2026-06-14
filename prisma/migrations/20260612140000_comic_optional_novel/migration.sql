-- SQLite: rebuild Comic so novelId is optional (standalone comic pipeline)
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerKey" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "novelId" TEXT,
    "shareCode" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL,
    "creativeBriefJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "coverPath" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comic_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Comic" (
    "id", "ownerKey", "visibility", "featured", "novelId", "shareCode", "title", "prompt",
    "imageUrls", "creativeBriefJson", "status", "coverPath", "likeCount", "createdAt", "updatedAt"
)
SELECT
    "id", "ownerKey", "visibility", "featured", "novelId", "shareCode", "title", "prompt",
    "imageUrls", "creativeBriefJson", "status", "coverPath", "likeCount", "createdAt", "updatedAt"
FROM "Comic";

DROP TABLE "Comic";
ALTER TABLE "new_Comic" RENAME TO "Comic";

CREATE INDEX "Comic_ownerKey_idx" ON "Comic"("ownerKey");
CREATE INDEX "Comic_novelId_idx" ON "Comic"("novelId");
CREATE UNIQUE INDEX "Comic_shareCode_key" ON "Comic"("shareCode");
CREATE INDEX "Comic_visibility_featured_likeCount_idx" ON "Comic"("visibility", "featured", "likeCount");
CREATE INDEX "Comic_visibility_createdAt_idx" ON "Comic"("visibility", "createdAt");

PRAGMA foreign_keys=ON;
