-- Remove only StudyFlow's integration metadata; no filesystem operations.
UPDATE "UserSettings" SET "defaultPage" = 'today' WHERE "defaultPage" = 'notes';
DROP TABLE "TaskNote";
DROP TABLE "VaultLink";
DROP TABLE "VaultNoteTag";
DROP TABLE "VaultProperty";
DROP TABLE "VaultAttachment";
DROP TABLE "VaultTag";
DROP TABLE "VaultNote";
DROP TABLE "VaultConnection";
