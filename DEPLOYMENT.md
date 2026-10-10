# Deployment (persiapan, belum dipublikasikan)

Target yang didukung konfigurasi ini adalah satu proses Node.js dengan SQLite dan penyimpanan permanen. Jangan menjalankan replika aplikasi dengan database lokal yang berbeda.

## Environment produksi

- `DATABASE_URL=file:/data/masjid.db`
- `UPLOAD_DIR=/data/uploads`
- `NEXTAUTH_URL=https://domain-masjid`
- `NEXTAUTH_SECRET`: nilai acak dari pengelola secret hosting.
- `TELEGRAM_BOT_TOKEN`: token BotFather, hanya di environment server.
- `TELEGRAM_WEBHOOK_SECRET`: nilai acak yang hanya berisi huruf, angka, `_`, atau `-`.

Mount disk/volume permanen pada `/data`. Pastikan pengguna container UID 1000 dapat menulis ke volume. Railway dapat menggunakan Dockerfile ini; pada VPS jalankan container di belakang reverse proxy HTTPS. Jangan membuat database baru di atas data produksi yang sudah ada: backup dahulu, pindahkan database dan uploads lama, lalu terapkan migrasi.

Dockerfile belum diverifikasi lewat Docker pada lingkungan kerja ini. Build aplikasi dan pengujian harus lulus sebelum image dipublikasikan.

## Telegram

Setelah server HTTPS berjalan, jalankan `node scripts/register-telegram.mjs` dengan environment produksi. Script mendaftarkan webhook dengan satu koneksi agar percakapan diproses berurutan. Admin menautkan ID Telegram numerik ke pengguna. Role `bendahara` dan `admin` mengelola kas; `konten`, `pengurus`, dan `admin` mengelola tayangan.

Percakapan berlaku 24 jam. Transaksi baru disimpan setelah tombol Simpan. ID update disimpan untuk mencegah transaksi ganda saat Telegram mengirim ulang. Balasan disimpan agar dapat dicoba lagi jika pengiriman gagal; balasan chat dapat terulang jika proses berhenti setelah Telegram menerima pesan tetapi sebelum status pengiriman disimpan.

## Backup

Jalankan `scripts/backup.sh` dengan `BACKUP_DIR` pada penyimpanan backup terpisah, idealnya saat tidak ada unggahan baru. Script memakai backup SQLite, bukan salinan file database yang sedang ditulis. Salin hasilnya ke lokasi terpisah dari server dan lakukan uji pemulihan sebelum penggunaan produksi.

## Status implementasi

Backend awal tersedia dan memiliki pengujian lokal. Dashboard keuangan baru, pengelolaan tayangan, player offline, ekspor laporan, penyuntingan konten lewat Telegram, serta pengujian browser belum selesai. Jangan deploy revisi ini sebagai versi fitur lengkap.
