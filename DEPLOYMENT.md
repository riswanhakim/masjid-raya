# Deployment: Vercel + Supabase

Aplikasi berjalan di Vercel. Database PostgreSQL dan berkas unggahan ada di Supabase. Kode ada di GitHub (`99apps-id/masjid-raya`), dan setiap push ke `main` dideploy otomatis oleh Vercel.

Gunakan dua proyek Supabase: satu untuk **dev** (preview lokal dan tes) dan satu untuk **produksi**. Data uji tidak boleh masuk ke database produksi.

## 1. Supabase (lakukan untuk proyek dev dan produksi)

1. Buat proyek baru di <https://supabase.com/dashboard>. Simpan sandi database.
2. **Project Settings > Database > Connection string**, pilih tab URI:
   - *Transaction pooler* (port 6543) untuk `DATABASE_URL`. Tambahkan `?pgbouncer=true&connection_limit=1` di ujungnya.
   - *Session pooler* atau *Direct* (port 5432) untuk `DIRECT_URL`.
3. **Project Settings > API**: salin *Project URL* ke `SUPABASE_URL` dan kunci *service_role* ke `SUPABASE_SERVICE_ROLE_KEY`. Kunci ini memberi akses penuh, jadi simpan hanya di environment server dan `.env` lokal yang tidak di-commit.
4. Dari komputer pengembang, isi keempat nilai itu di `.env`, lalu jalankan:

```bash
npm run db:migrate
```

```bash
npm run supabase:siapkan
```

```bash
npx prisma db seed
```

`db:migrate` membuat tabel dan menyalakan Row Level Security di semua tabel, sehingga Data API Supabase tidak bisa membaca data kas atau akun. Aplikasi tetap bisa mengakses karena memakai Prisma sebagai pemilik tabel. `supabase:siapkan` membuat bucket `publik` (foto, logo, suara adzan) dan `privat` (bukti transaksi). `db seed` membuat akun admin dan pengurus awal dengan sandi dari `SEED_ADMIN_PASSWORD` dan `SEED_PENGURUS_PASSWORD`. Ganti sandi itu setelah masuk pertama kali.

Build Vercel tidak menjalankan migrasi atau seed. Migrasi selalu dijalankan sengaja dari komputer pengembang.

## 2. Vercel

1. Di <https://vercel.com/new>, impor repositori `99apps-id/masjid-raya`. Framework terdeteksi sebagai Next.js; perintah build `npm run build` sudah termasuk `prisma generate`.
2. Isi **Environment Variables** (Production):

| Nama | Isi |
|---|---|
| `DATABASE_URL` | URI pooler port 6543 + `?pgbouncer=true&connection_limit=1` (proyek produksi) |
| `DIRECT_URL` | URI port 5432 (proyek produksi) |
| `SUPABASE_URL` | Project URL produksi |
| `SUPABASE_SERVICE_ROLE_KEY` | kunci service_role produksi |
| `NEXTAUTH_SECRET` | nilai acak: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXTAUTH_URL` | alamat situs, mis. `https://masjid-raya.vercel.app` |
| `TELEGRAM_BOT_TOKEN` | token dari @BotFather (opsional, untuk bot) |
| `TELEGRAM_WEBHOOK_SECRET` | nilai acak huruf/angka (opsional, untuk bot) |

3. Deploy. Setelah alamat situs final diketahui, pastikan `NEXTAUTH_URL` sama persis dengan alamat itu, lalu deploy ulang.

## 3. Bot Telegram

Setelah situs produksi berjalan di HTTPS, isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, dan `NEXTAUTH_URL` produksi di `.env` lokal, lalu jalankan:

```bash
node scripts/register-telegram.mjs
```

Admin menautkan ID Telegram numerik tiap pengurus di **Pengguna & Telegram**. Role `bendahara` dan `admin` mengelola kas; `konten`, `pengurus`, dan `admin` mengelola tayangan.

## 4. Layar TV

Buka `https://<alamat-situs>/?tv=1` di browser TV, sebaiknya Chrome mode kiosk dengan opsi `--kiosk --autoplay-policy=no-user-gesture-required` agar layar penuh permanen dan murottal bisa berbunyi tanpa disentuh. Layar memuat ulang sendiri saat versi baru dideploy.

## Batasan yang perlu diketahui

- Unggahan maksimal 4 MB per berkas karena Vercel membatasi badan permintaan 4,5 MB. Foto besar diperkecil otomatis di browser sebelum diunggah.
- Pembatas laju (rate limit) login dan unggah masih di memori tiap instance Vercel, jadi berlaku per instance, bukan global.
- Tabel `TelegramUpdate` belum dibersihkan berkala.
- Backup: aktifkan backup harian di paket Supabase yang dipilih, dan uji pemulihannya sebelum dipakai untuk pencatatan kas sungguhan.

## Pengembangan lokal

Isi `.env` dengan nilai proyek Supabase **dev**, lalu `npm run dev`. Tanpa `SUPABASE_URL`, unggahan disimpan ke folder `uploads/`. Tes: `npm test` menjalankan tes unit; isi `TEST_DATABASE_URL` (mis. URI dev dengan `?schema=uji`) untuk ikut menjalankan tes integrasi.

Riwayat migrasi SQLite lama disimpan di `prisma/arsip-migrasi-sqlite/` sebagai arsip; tidak dipakai lagi.
