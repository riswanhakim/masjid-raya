-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TvSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jenis" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT,
    "gambar" TEXT,
    "mulai" DATETIME NOT NULL,
    "selesai" DATETIME NOT NULL,
    "durasi" INTEGER NOT NULL DEFAULT 15,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramConversation" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'jamaah',
    "password" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "telegramId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("createdAt", "email", "emailVerified", "id", "image", "name", "password", "role") SELECT "createdAt", "email", "emailVerified", "id", "image", "name", "password", "role" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");
CREATE TABLE "new_kas_transaksi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tanggal" DATETIME NOT NULL,
    "jenis" TEXT NOT NULL,
    "kategori" TEXT,
    "keterangan" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "dana" TEXT NOT NULL DEFAULT 'Operasional',
    "bukti" TEXT,
    "pencatatId" TEXT,
    "sumber" TEXT NOT NULL DEFAULT 'panel',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_kas_transaksi" ("createdAt", "id", "jenis", "jumlah", "kategori", "keterangan", "tanggal") SELECT "createdAt", "id", "jenis", "jumlah", "kategori", "keterangan", "tanggal" FROM "kas_transaksi";
DROP TABLE "kas_transaksi";
ALTER TABLE "new_kas_transaksi" RENAME TO "kas_transaksi";
CREATE INDEX "kas_transaksi_tanggal_idx" ON "kas_transaksi"("tanggal");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

