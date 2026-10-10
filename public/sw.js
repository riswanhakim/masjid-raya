/*
 * Service worker layar TV (PRD OFF-01). Hanya menyimpan data publik:
 * halaman layar, aset statis, paket tayangan, jadwal, dan media publik.
 * Panel admin, autentikasi, dan bukti transaksi tidak pernah di-cache.
 */
const CACHE = "tv-masjid-v3";

const TIDAK_PERNAH = [/^\/admin/, /^\/api\/admin/, /^\/api\/auth/, /^\/api\/media\/bukti\//, /^\/login/, /^\/akun/, /^\/jamaah/, /^\/api\/telegram/, /^\/api\/upload/];
const ASET_TETAP = [/^\/_next\/static\//, /^\/fonts\//, /^\/audio\//, /^\/api\/media\/(tayangan|kegiatan|berita|profil|adzan)\//];
// Hanya halaman layar. Data /api/tv dan /api/jadwal sengaja tidak disajikan
// dari cache: layar menyimpan paketnya sendiri di localStorage, dan kegagalan
// fetch yang jujur dipakai untuk menampilkan tanda "Offline".
const DATA_TERBARU = [/^\/$/];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((daftar) => Promise.all(daftar.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (TIDAK_PERNAH.some((r) => r.test(url.pathname))) return;
  // Permintaan rentang (pemutaran audio) dilayani dari berkas utuh di cache.
  if (ASET_TETAP.some((r) => r.test(url.pathname))) {
    event.respondWith(cacheDulu(req));
    return;
  }
  if (DATA_TERBARU.some((r) => r.test(url.pathname))) {
    event.respondWith(jaringanDulu(req));
  }
});

async function cacheDulu(req) {
  const cache = await caches.open(CACHE);
  const kunci = req.url;
  const ada = await cache.match(kunci);
  if (ada) return ada;
  const res = await fetch(req.headers.has("range") ? kunci : req);
  if (res.ok && res.status === 200) cache.put(kunci, res.clone());
  return res;
}

async function jaringanDulu(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req.url, res.clone());
    return res;
  } catch (galat) {
    const ada = await cache.match(req.url);
    if (ada) return ada;
    throw galat;
  }
}

// Pangkas aset lama atas permintaan halaman layar: hapus entri yang cocok
// dengan pola tetapi tidak ada di daftar aset paket yang sedang dipakai.
self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || d.jenis !== "pangkas" || typeof d.pola !== "string" || !Array.isArray(d.simpan)) return;
  const pola = new RegExp(d.pola);
  const simpan = new Set(d.simpan);
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const req of await cache.keys()) {
        const u = new URL(req.url);
        if (pola.test(u.pathname) && !simpan.has(u.href)) await cache.delete(req);
      }
    })
  );
});
