-- CreateTable
CREATE TABLE "PlatformEmailConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "configEnc" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEmailConfig_pkey" PRIMARY KEY ("id")
);
