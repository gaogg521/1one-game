-- AlterTable
ALTER TABLE "Project" ADD COLUMN "generationProvider" TEXT;
ALTER TABLE "Project" ADD COLUMN "generationModel" TEXT;

-- AlterTable
ALTER TABLE "Novel" ADD COLUMN "generationProvider" TEXT;
ALTER TABLE "Novel" ADD COLUMN "generationModel" TEXT;

-- AlterTable
ALTER TABLE "Comic" ADD COLUMN "generationProvider" TEXT;
ALTER TABLE "Comic" ADD COLUMN "generationModel" TEXT;
