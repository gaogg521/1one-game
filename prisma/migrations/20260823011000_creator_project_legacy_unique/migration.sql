-- Prevent duplicate shadow projects when a legacy work is retried or a request reconnects.
CREATE UNIQUE INDEX "CreativeProject_legacyType_legacyId_key" ON "CreativeProject"("legacyType", "legacyId");
