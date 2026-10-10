import test from "node:test";
import assert from "node:assert/strict";
import { bacaFilter, hitungLaporan, type BarisKas } from "../src/lib/laporan-kas";
import { isoKeLokal, lokalKeIso, slideBerlaku, statusSlide } from "../src/lib/tv";

const t = (id: string, tanggal: string, jenis: "masuk" | "keluar", jumlah: number, dana = "Operasional", kategori: string | null = null, keterangan = id): BarisKas => ({
  id, tanggal: new Date(`${tanggal}T00:00:00Z`), jenis, jumlah, dana, kategori, keterangan,
});

const rows = [
  t("a", "2026-08-01", "masuk", 5_000_000, "Operasional", "Saldo pembukaan"),
  t("b", "2026-08-15", "keluar", 800_000, "Operasional", "Listrik", "Listrik Agustus"),
  t("c", "2026-09-05", "masuk", 1_250_000, "Operasional", "Infak Jumat"),
  t("d", "2026-09-20", "masuk", 3_000_000, "Pembangunan", "Donasi"),
  t("e", "2026-09-30", "keluar", 225_000, "Operasional", "Kebersihan"),
  t("f", "2026-10-01", "masuk", 2_000_000, "Zakat", "Zakat"),
];
const semua = { dana: "", kategori: "", jenis: "" as const, q: "" };

test("saldo akhir = saldo awal + pemasukan - pengeluaran, termasuk transaksi sebelum periode", () => {
  const lap = hitungLaporan(rows, { dari: "2026-09-01", sampai: "2026-09-30", ...semua });
  assert.deepEqual(lap.ringkasan, { saldoAwal: 4_200_000, masuk: 4_250_000, keluar: 225_000, saldoAkhir: 8_225_000 });
  assert.equal(lap.baris.length, 3);
  // Transaksi setelah periode tidak ikut saldo per dana.
  assert.equal(lap.saldoPerDana.find((d) => d.dana === "Zakat"), undefined);
});

test("filter dana memisahkan saldo, dan beberapa dana dijumlahkan benar", () => {
  const op = hitungLaporan(rows, { dari: "2026-09-01", sampai: "2026-10-31", ...semua, dana: "Operasional" });
  assert.equal(op.ringkasan.saldoAwal, 4_200_000);
  assert.equal(op.ringkasan.saldoAkhir, 5_225_000);
  const all = hitungLaporan(rows, { dari: "2026-01-01", sampai: "2026-12-31", ...semua });
  const totalDana = all.saldoPerDana.reduce((s, d) => s + d.saldo, 0);
  assert.equal(totalDana, all.ringkasan.saldoAkhir);
});

test("saringan jenis/kategori/pencarian hanya mengubah daftar dan subtotal, bukan ringkasan saldo", () => {
  const lap = hitungLaporan(rows, { dari: "2026-08-01", sampai: "2026-10-31", ...semua, q: "listrik" });
  assert.equal(lap.baris.length, 1);
  assert.equal(lap.subtotal.keluar, 800_000);
  assert.equal(lap.ringkasan.saldoAkhir, 10_225_000);
  assert.equal(lap.daftarTersaring, true);
  const k = hitungLaporan(rows, { dari: "2026-08-01", sampai: "2026-10-31", ...semua, kategori: "Tanpa kategori" });
  assert.equal(k.baris.length, 0);
});

test("rekap bulanan dan kategori cocok dengan total periode", () => {
  const lap = hitungLaporan(rows, { dari: "2026-08-01", sampai: "2026-10-10", ...semua });
  assert.deepEqual(lap.bulanan.map((b) => b.bulan), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(lap.bulanan.reduce((s, b) => s + b.masuk, 0), lap.ringkasan.masuk);
  assert.equal(lap.kategori.filter((k) => k.jenis === "keluar").reduce((s, k) => s + k.total, 0), lap.ringkasan.keluar);
  // Periode "seluruh catatan" tidak membuat ribuan bulan kosong.
  const panjang = hitungLaporan(rows, { dari: "0001-01-01", sampai: "2026-10-10", ...semua });
  assert.equal(panjang.bulanan[0].bulan, "2026-08");
});

test("filter tidak sah jatuh ke bulan berjalan dengan pesan", () => {
  const ok = bacaFilter({}, "2026-10-10");
  assert.equal(ok.filter.dari, "2026-10-01");
  assert.equal(ok.galat, null);
  const salah = bacaFilter({ dari: "2026-10-10", sampai: "2026-10-01" }, "2026-10-10");
  assert.ok(salah.galat);
  assert.equal(salah.filter.dari, "2026-10-01");
});

test("status slide dan konversi waktu masjid tanpa bergantung zona komputer", () => {
  const now = new Date("2026-10-10T05:00:00Z");
  const s = (mulai: string, selesai: string, aktif = true) => ({ aktif, mulai, selesai });
  assert.equal(statusSlide(s("2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z"), now), "tayang");
  assert.equal(statusSlide(s("2026-10-11T00:00:00Z", "2026-10-12T00:00:00Z"), now), "dijadwalkan");
  assert.equal(statusSlide(s("2026-10-01T00:00:00Z", "2026-10-10T05:00:00Z"), now), "kedaluwarsa");
  assert.equal(statusSlide(s("2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z", false), now), "nonaktif");
  assert.equal(slideBerlaku([s("2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z"), s("2026-10-11T00:00:00Z", "2026-10-12T00:00:00Z")], now).length, 1);
  assert.equal(new Date(lokalKeIso("2026-10-16T19:30", "Asia/Makassar")).toISOString(), "2026-10-16T11:30:00.000Z");
  assert.equal(isoKeLokal("2026-10-16T11:30:00Z", "Asia/Jayapura"), "2026-10-16T20:30");
});

test("tampilan foto penuh: wajib foto, tidak untuk ringkasan kas, bawaan standar", async () => {
  const { slideSchema } = await import("../src/lib/tv");
  const dasar = { jenis: "pengumuman", judul: "Poster", mulai: "2026-10-10T00:00:00Z", selesai: "2026-10-11T00:00:00Z", durasi: 10, urutan: 0, aktif: true };
  assert.equal(slideSchema.parse(dasar).tampilan, "standar");
  assert.equal(slideSchema.safeParse({ ...dasar, tampilan: "foto" }).success, false);
  assert.equal(slideSchema.safeParse({ ...dasar, tampilan: "foto", gambar: `/api/media/tayangan/${"a".repeat(32)}.jpg` }).success, true);
  assert.equal(slideSchema.safeParse({ ...dasar, jenis: "kas", tampilan: "foto", gambar: `/api/media/tayangan/${"a".repeat(32)}.jpg` }).success, false);
});
