-- Align SQLite with schema: public discovery visibility + featured flags
ALTER TABLE "Project" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "Project" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Novel" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "Novel" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Comic" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "Comic" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Project_visibility_featured_playCount_idx" ON "Project"("visibility", "featured", "playCount");
CREATE INDEX "Project_visibility_createdAt_idx" ON "Project"("visibility", "createdAt");

CREATE INDEX "Novel_visibility_featured_playCount_idx" ON "Novel"("visibility", "featured", "playCount");
CREATE INDEX "Novel_visibility_createdAt_idx" ON "Novel"("visibility", "createdAt");

CREATE INDEX "Comic_visibility_featured_likeCount_idx" ON "Comic"("visibility", "featured", "likeCount");
CREATE INDEX "Comic_visibility_createdAt_idx" ON "Comic"("visibility", "createdAt");
