import test from "node:test";
import assert from "node:assert/strict";
import { batasiLaju } from "../src/lib/rate-limit";
import { canFinance, canContent } from "../src/lib/permissions";
import { slideSchema } from "../src/lib/tv";
import { kasBuatSchema } from "../src/lib/validasi";

test("cleanup preserves the longer account rate-limit window", () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    assert.equal(batasiLaju("test-long-window", 1, 900000).boleh, true);
    now += 660000;
    batasiLaju("test-short-window", 1, 600000);
    assert.equal(batasiLaju("test-long-window", 1, 900000).boleh, false);
    now += 240001;
    assert.equal(batasiLaju("test-long-window", 1, 900000).boleh, true);
  } finally { Date.now = realNow; }
});

test("finance and content responsibilities are separated", () => {
  assert.equal(canFinance("bendahara"), true);
  assert.equal(canContent("bendahara"), false);
  assert.equal(canFinance("konten"), false);
  assert.equal(canFinance("pengurus"), false);
  assert.equal(canContent("pengurus"), true);
  assert.equal(canFinance("admin"), true);
  assert.equal(canContent("admin"), true);
});

test("slides reject invalid schedules and gallery without a photo", () => {
  const slide = { jenis: "pengumuman", judul: "Pengajian", mulai: "2026-09-25T00:00:00Z", selesai: "2026-09-26T00:00:00Z", durasi: 15, urutan: 0, aktif: true };
  assert.equal(slideSchema.safeParse(slide).success, true);
  assert.equal(slideSchema.safeParse({ ...slide, selesai: slide.mulai }).success, false);
  assert.equal(slideSchema.safeParse({ ...slide, jenis: "galeri" }).success, false);
  assert.equal(slideSchema.safeParse({ ...slide, gambar: "/api/media/bukti/abc.jpg" }).success, false);
});

test("finance validates database integer range and private receipt paths", () => {
  const row = { tanggal: "2026-09-25", jenis: "keluar", jumlah: 350000, keterangan: "Listrik", dana: "Operasional" };
  assert.equal(kasBuatSchema.safeParse(row).success, true);
  assert.equal(kasBuatSchema.safeParse({ ...row, jumlah: 2147483648 }).success, false);
  assert.equal(kasBuatSchema.safeParse({ ...row, bukti: "https://example.com/bukti.jpg" }).success, false);
});
