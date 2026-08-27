-- Store coarse delivery evidence without raw inputs, identity, user-agent, or fingerprints.
ALTER TABLE "GameplayEvent" ADD COLUMN "activeMs" INTEGER;
ALTER TABLE "GameplayEvent" ADD COLUMN "actionCount" INTEGER;
ALTER TABLE "GameplayEvent" ADD COLUMN "deviceClass" TEXT;
ALTER TABLE "GameplayEvent" ADD COLUMN "orientation" TEXT;
ALTER TABLE "GameplayEvent" ADD COLUMN "touchCapable" BOOLEAN;
