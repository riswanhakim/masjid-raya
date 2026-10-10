-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "alasan" TEXT;

-- AlterTable
ALTER TABLE "TvSlide" ADD COLUMN "lokasi" TEXT;
ALTER TABLE "TvSlide" ADD COLUMN "penceramah" TEXT;
ALTER TABLE "TvSlide" ADD COLUMN "waktuKegiatan" DATETIME;

-- CreateTable
CREATE TABLE "Dana" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Dana_nama_key" ON "Dana"("nama");

-- Isi daftar dana dari transaksi yang sudah ada, lalu tambahkan tiga dana
-- bawaan bila belum ada. Ejaan yang berbeda huruf besar-kecilnya disatukan
-- ke ejaan yang pertama kali muncul.
INSERT INTO "Dana" ("id", "nama", "aktif", "urutan", "createdAt")
SELECT lower(hex(randomblob(12))), trim(MIN("dana")), true, 0, CURRENT_TIMESTAMP
FROM "kas_transaksi"
GROUP BY lower(trim("dana"));

UPDATE "kas_transaksi" SET "dana" = (
  SELECT "nama" FROM "Dana" WHERE lower("Dana"."nama") = lower(trim("kas_transaksi"."dana"))
);

INSERT INTO "Dana" ("id", "nama", "aktif", "urutan", "createdAt")
SELECT lower(hex(randomblob(12))), v.nama, true, v.urutan, CURRENT_TIMESTAMP
FROM (SELECT 'Operasional' AS nama, 1 AS urutan UNION ALL SELECT 'Pembangunan', 2 UNION ALL SELECT 'Zakat', 3) v
WHERE NOT EXISTS (SELECT 1 FROM "Dana" d WHERE lower(d."nama") = lower(v.nama));
