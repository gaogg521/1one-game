-- CreateTable
CREATE TABLE "Novel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerKey" TEXT NOT NULL,
    "shareCode" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "coverPath" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerKey" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "shareCode" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comic_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Novel_ownerKey_idx" ON "Novel"("ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "Novel_shareCode_key" ON "Novel"("shareCode");

-- CreateIndex
CREATE INDEX "Comic_ownerKey_idx" ON "Comic"("ownerKey");

-- CreateIndex
CREATE INDEX "Comic_novelId_idx" ON "Comic"("novelId");

-- CreateIndex
CREATE UNIQUE INDEX "Comic_shareCode_key" ON "Comic"("shareCode");
