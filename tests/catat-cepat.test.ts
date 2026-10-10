import test from "node:test";
import assert from "node:assert/strict";
import { bacaCatatanCepat, bacaNominal } from "../src/lib/catat-cepat";

const opsi = { hariIni: "2026-10-10", danaAktif: ["Operasional", "Pembangunan", "Zakat", "Qurban 1448 H"], kategori: ["Listrik", "Infak Jumat", "Konsumsi"] };
const baca = (t: string, o = {}) => bacaCatatanCepat(t, { ...opsi, ...o });

test("nominal: rb, ribu, k, jt, titik ribuan, Rp, desimal", () => {
  assert.equal(bacaNominal("300rb"), 300000);
  assert.equal(bacaNominal("300", "ribu"), 300000);
  assert.equal(bacaNominal("50k"), 50000);
  assert.equal(bacaNominal("1,5jt"), 1500000);
  assert.equal(bacaNominal("1.5jt"), 1500000);
  assert.equal(bacaNominal("300.000"), 300000);
  assert.equal(bacaNominal("1.250.000"), 1250000);
  assert.equal(bacaNominal("Rp300.000"), 300000);
  assert.equal(bacaNominal("350000"), 350000);
  assert.equal(bacaNominal("abc"), null);
  assert.equal(bacaNominal("0"), null);
});

test("satu baris pemasukan memakai bawaan: dana pertama, hari ini", () => {
  const h = baca("+300rb kotak jumat");
  assert.ok(h.ok);
  assert.deepEqual(h.catatan, { jenis: "masuk", jumlah: 300000, keterangan: "Kotak jumat", dana: "Operasional", kategori: null, tanggal: "2026-10-10" });
});

test("pengeluaran dengan dana, tanggal, kategori otomatis", () => {
  const h = baca("-150.000 bayar listrik #pemb kemarin");
  assert.ok(h.ok);
  assert.equal(h.catatan.jenis, "keluar");
  assert.equal(h.catatan.jumlah, 150000);
  assert.equal(h.catatan.dana, "Pembangunan");
  assert.equal(h.catatan.tanggal, "2026-10-09");
  assert.equal(h.catatan.kategori, "Listrik");
  assert.equal(h.catatan.keterangan, "Bayar listrik");
  const q = baca("+2jt titipan qurban #qurban tgl 3");
  assert.ok(q.ok);
  assert.equal(q.catatan.dana, "Qurban 1448 H");
  assert.equal(q.catatan.tanggal, "2026-10-03");
  const r = baca("+ Rp 75.000 infak jumat 2/10");
  assert.ok(r.ok);
  assert.equal(r.catatan.jumlah, 75000);
  assert.equal(r.catatan.kategori, "Infak Jumat");
  assert.equal(r.catatan.tanggal, "2026-10-02");
});

test("jenis dari menu tanpa tanda, dan pesan galat yang jelas", () => {
  const h = baca("300 ribu kotak amal", { jenisBawaan: "masuk" });
  assert.ok(h.ok);
  assert.equal(h.catatan.jumlah, 300000);
  assert.equal(h.catatan.keterangan, "Kotak amal");
  assert.equal(baca("300rb kotak").ok, false);
  assert.match((baca("+kotak jumat") as { pesan: string }).pesan, /Nominal/);
  assert.match((baca("+300rb") as { pesan: string }).pesan, /keterangan/);
  assert.match((baca("+300rb kas #hantu") as { pesan: string }).pesan, /tidak ada/);
  assert.match((baca("+300rb kas 31/2") as { pesan: string }).pesan, /kalender/);
  assert.match((baca("+300rb kas 2026-12-01") as { pesan: string }).pesan, /masa depan/);
  assert.match((baca("+3000000000 kas") as { pesan: string }).pesan, /maksimal/);
});
