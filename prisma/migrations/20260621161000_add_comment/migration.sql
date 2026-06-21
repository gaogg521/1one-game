-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workType" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '访客',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Comment_workType_workId_createdAt_idx" ON "Comment"("workType", "workId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_ownerKey_idx" ON "Comment"("ownerKey");
