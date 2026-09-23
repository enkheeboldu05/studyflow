-- CreateTable
CREATE TABLE "VaultConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rootFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "lastIndexedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VaultConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaultId" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "modifiedAt" DATETIME NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "aliasesJson" TEXT NOT NULL DEFAULT '[]',
    "isMap" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "indexedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaultNote_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "VaultConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultProperty" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "noteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    CONSTRAINT "VaultProperty_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "VaultNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaultId" INTEGER NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    CONSTRAINT "VaultTag_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "VaultConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultNoteTag" (
    "noteId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    PRIMARY KEY ("noteId", "tagId"),
    CONSTRAINT "VaultNoteTag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "VaultNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VaultNoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "VaultTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaultId" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "modifiedAt" DATETIME NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "VaultAttachment_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "VaultConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceNoteId" INTEGER NOT NULL,
    "targetNoteId" INTEGER,
    "targetAttachmentId" INTEGER,
    "rawTarget" TEXT NOT NULL,
    "normalizedTarget" TEXT NOT NULL,
    "heading" TEXT,
    "blockId" TEXT,
    "kind" TEXT NOT NULL,
    "embedded" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "VaultLink_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "VaultNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VaultLink_targetNoteId_fkey" FOREIGN KEY ("targetNoteId") REFERENCES "VaultNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VaultLink_targetAttachmentId_fkey" FOREIGN KEY ("targetAttachmentId") REFERENCES "VaultAttachment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskNote" (
    "taskId" INTEGER NOT NULL,
    "noteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("taskId", "noteId"),
    CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "VaultNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VaultConnection_userId_key" ON "VaultConnection"("userId");

-- CreateIndex
CREATE INDEX "VaultNote_vaultId_title_idx" ON "VaultNote"("vaultId", "title");

-- CreateIndex
CREATE INDEX "VaultNote_vaultId_folder_idx" ON "VaultNote"("vaultId", "folder");

-- CreateIndex
CREATE INDEX "VaultNote_vaultId_contentHash_idx" ON "VaultNote"("vaultId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "VaultNote_vaultId_normalizedPath_key" ON "VaultNote"("vaultId", "normalizedPath");

-- CreateIndex
CREATE INDEX "VaultProperty_noteId_normalizedName_idx" ON "VaultProperty"("noteId", "normalizedName");

-- CreateIndex
CREATE INDEX "VaultProperty_normalizedName_value_idx" ON "VaultProperty"("normalizedName", "value");

-- CreateIndex
CREATE UNIQUE INDEX "VaultTag_vaultId_normalizedName_key" ON "VaultTag"("vaultId", "normalizedName");

-- CreateIndex
CREATE INDEX "VaultNoteTag_tagId_idx" ON "VaultNoteTag"("tagId");

-- CreateIndex
CREATE INDEX "VaultAttachment_vaultId_normalizedPath_idx" ON "VaultAttachment"("vaultId", "normalizedPath");

-- CreateIndex
CREATE UNIQUE INDEX "VaultAttachment_vaultId_normalizedPath_key" ON "VaultAttachment"("vaultId", "normalizedPath");

-- CreateIndex
CREATE INDEX "VaultLink_sourceNoteId_idx" ON "VaultLink"("sourceNoteId");

-- CreateIndex
CREATE INDEX "VaultLink_targetNoteId_idx" ON "VaultLink"("targetNoteId");

-- CreateIndex
CREATE INDEX "VaultLink_targetAttachmentId_idx" ON "VaultLink"("targetAttachmentId");

-- CreateIndex
CREATE INDEX "TaskNote_noteId_idx" ON "TaskNote"("noteId");
