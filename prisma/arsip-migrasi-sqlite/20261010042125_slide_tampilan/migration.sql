-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TvSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jenis" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT,
    "gambar" TEXT,
    "penceramah" TEXT,
    "waktuKegiatan" DATETIME,
    "lokasi" TEXT,
    "tampilan" TEXT NOT NULL DEFAULT 'standar',
    "mulai" DATETIME NOT NULL,
    "selesai" DATETIME NOT NULL,
    "durasi" INTEGER NOT NULL DEFAULT 15,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TvSlide" ("aktif", "createdAt", "durasi", "gambar", "id", "isi", "jenis", "judul", "lokasi", "mulai", "penceramah", "selesai", "updatedAt", "urutan", "waktuKegiatan") SELECT "aktif", "createdAt", "durasi", "gambar", "id", "isi", "jenis", "judul", "lokasi", "mulai", "penceramah", "selesai", "updatedAt", "urutan", "waktuKegiatan" FROM "TvSlide";
DROP TABLE "TvSlide";
ALTER TABLE "new_TvSlide" RENAME TO "TvSlide";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
