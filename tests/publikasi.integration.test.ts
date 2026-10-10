import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { ringkasanKasPublik, danaResmi } from "../src/lib/data-kas";
import { GET as tvGet } from "../src/app/api/tv/route";

async function aturPengaturan(nilai: Record<string, string>) {
  for (const [key, value] of Object.entries(nilai)) {
    await prisma.pengaturan.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

test("publikasi kas: mati berarti tanpa angka di API publik; nyala hanya angka agregat dana terpilih", async () => {
  const sebelum = await prisma.pengaturan.findMany({ where: { key: { in: ["kas_publik", "kas_publik_dana", "kas_publik_periode"] } } });
  const tag = `uji-${Date.now()}`;
  const hariIni = new Date().toISOString().slice(0, 10);
  const trx = await prisma.kasTransaksi.createManyAndReturn({
    data: [
      { tanggal: new Date(`${hariIni}T00:00:00Z`), jenis: "masuk", jumlah: 700, dana: "Operasional", keterangan: `${tag} rahasia donatur A`, bukti: "/api/media/bukti/" + "a".repeat(32) + ".jpg" },
      { tanggal: new Date(`${hariIni}T00:00:00Z`), jenis: "masuk", jumlah: 900, dana: "Zakat", keterangan: `${tag} zakat B` },
    ],
  });
  const slide = await prisma.tvSlide.create({ data: { jenis: "kas", judul: tag, mulai: new Date(Date.now() - 60000), selesai: new Date(Date.now() + 3600000) } });
  try {
    await aturPengaturan({ kas_publik: "false" });
    assert.equal(await ringkasanKasPublik(), null);
    let body = await (await tvGet()).json();
    assert.equal(body.finance, null);
    assert.ok(!body.slides.some((s: { id: string }) => s.id === slide.id), "slide kas disembunyikan saat publikasi mati");

    await aturPengaturan({ kas_publik: "true", kas_publik_dana: "Zakat", kas_publik_periode: "semua" });
    const r = await ringkasanKasPublik();
    assert.ok(r);
    assert.deepEqual(r.dana.map((d) => d.nama), ["Zakat"]);
    body = await (await tvGet()).json();
    assert.ok(body.slides.some((s: { id: string }) => s.id === slide.id));
    const teks = JSON.stringify(body);
    assert.ok(!teks.includes("rahasia donatur"), "keterangan transaksi tidak bocor");
    assert.ok(!teks.includes("/api/media/bukti/"), "bukti tidak bocor");
    assert.ok(!teks.includes("pencatat"), "pencatat tidak bocor");
  } finally {
    await prisma.tvSlide.delete({ where: { id: slide.id } });
    await prisma.kasTransaksi.deleteMany({ where: { id: { in: trx.map((x) => x.id) } } });
    await prisma.pengaturan.deleteMany({ where: { key: { in: ["kas_publik", "kas_publik_dana", "kas_publik_periode"] } } });
    for (const b of sebelum) await prisma.pengaturan.create({ data: { key: b.key, value: b.value } });
  }
});

test("dana dicocokkan tanpa membedakan huruf besar-kecil dan dana nonaktif ditolak", async () => {
  assert.equal(await danaResmi("  zAkAt "), "Zakat");
  const d = await prisma.dana.create({ data: { nama: `Uji ${Date.now()}`, aktif: false } });
  try {
    assert.equal(await danaResmi(d.nama), null);
  } finally {
    await prisma.dana.delete({ where: { id: d.id } });
  }
});
