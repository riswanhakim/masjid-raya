-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'jamaah',
    "password" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "telegramId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "jadwal_shalat" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "lokasi" TEXT NOT NULL,
    "provinsi" TEXT,
    "imsak" TEXT NOT NULL,
    "subuh" TEXT NOT NULL,
    "terbit" TEXT,
    "dhuha" TEXT,
    "zuhur" TEXT NOT NULL,
    "ashar" TEXT NOT NULL,
    "maghrib" TEXT NOT NULL,
    "isya" TEXT NOT NULL,
    "sumber" TEXT NOT NULL DEFAULT 'hisab',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jadwal_shalat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "khutbah" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "tema" TEXT NOT NULL,
    "penceramah" TEXT NOT NULL,
    "lokasi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "khutbah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kegiatan" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3),
    "lokasi" TEXT,
    "gambar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT,
    "lokasi" TEXT,
    "deskripsi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ustadz" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "spesialisasi" TEXT,
    "bio" TEXT,
    "foto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ustadz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengurus" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "foto" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengurus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "berita" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "gambar" TEXT,
    "kategori" TEXT NOT NULL DEFAULT 'berita',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "berita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_masjid" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL DEFAULT 'Masjid Raya Pro',
    "deskripsi" TEXT,
    "visi" TEXT,
    "misi" TEXT,
    "sejarah" TEXT,
    "alamat" TEXT,
    "kontak" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "favicon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profil_masjid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengaturan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengaturan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kas_transaksi" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jenis" TEXT NOT NULL,
    "kategori" TEXT,
    "keterangan" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "dana" TEXT NOT NULL DEFAULT 'Operasional',
    "bukti" TEXT,
    "pencatatId" TEXT,
    "sumber" TEXT NOT NULL DEFAULT 'panel',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kas_transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galeri" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "gambar" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "galeri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petugas_jadwal" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "peran" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petugas_jadwal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "alasan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvSlide" (
    "id" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT,
    "gambar" TEXT,
    "penceramah" TEXT,
    "waktuKegiatan" TIMESTAMP(3),
    "lokasi" TEXT,
    "tampilan" TEXT NOT NULL DEFAULT 'standar',
    "mulai" TIMESTAMP(3) NOT NULL,
    "selesai" TIMESTAMP(3) NOT NULL,
    "durasi" INTEGER NOT NULL DEFAULT 15,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramConversation" (
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConversation_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "id" BIGINT NOT NULL,
    "reply" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dana" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dana_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "jadwal_shalat_tanggal_lokasi_key" ON "jadwal_shalat"("tanggal", "lokasi");

-- CreateIndex
CREATE UNIQUE INDEX "pengaturan_key_key" ON "pengaturan"("key");

-- CreateIndex
CREATE INDEX "kas_transaksi_tanggal_idx" ON "kas_transaksi"("tanggal");

-- CreateIndex
CREATE INDEX "petugas_jadwal_tanggal_idx" ON "petugas_jadwal"("tanggal");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Dana_nama_key" ON "Dana"("nama");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keamanan Supabase: aktifkan Row Level Security tanpa policy di semua tabel.
-- Aplikasi terhubung lewat Prisma sebagai pemilik tabel sehingga tidak terpengaruh,
-- tetapi Data API Supabase (anon/authenticated) tidak bisa membaca atau menulis
-- data kas, akun, dan audit (PRD bagian 8).
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jadwal_shalat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "khutbah" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kegiatan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agenda" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ustadz" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pengurus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "berita" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profil_masjid" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pengaturan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kas_transaksi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "galeri" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petugas_jadwal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvSlide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramUpdate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dana" ENABLE ROW LEVEL SECURITY;

-- Dana bawaan.
INSERT INTO "Dana" ("id", "nama", "aktif", "urutan") VALUES ('dana_operasional', 'Operasional', true, 1), ('dana_pembangunan', 'Pembangunan', true, 2), ('dana_zakat', 'Zakat', true, 3);
