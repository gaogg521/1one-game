-- CreateTable
CREATE TABLE "PlatformRuntimeConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "secretsEnc" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
