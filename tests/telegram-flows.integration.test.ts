import test, { after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { processTelegram } from "../src/lib/telegram";

type Reply = { chat_id: number; text: string; reply_markup?: { keyboard: { text: string }[][] } } | null;

const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let updateId = 1100000000 + Math.floor(Math.random() * 100000000);
const updateIds: number[] = [];
const userIds: string[] = [];
const slideIds: string[] = [];
const danaIds: string[] = [];

async function buatPengguna(role: string) {
  const telegramId = 700000000 + Math.floor(Math.random() * 100000000);
  const user = await prisma.user.create({ data: { email: `tg-${role}-${unique}-${telegramId}@example.invalid`, role, telegramId: String(telegramId) } });
  userIds.push(user.id);
  const send = async (text: string, id = ++updateId, extra: object = {}): Promise<Reply> => {
    updateIds.push(id);
    return processTelegram({ update_id: id, message: { from: { id: telegramId }, chat: { id: telegramId, type: "private" }, text, ...extra } });
  };
  return { user, telegramId, send };
}

const tombol = (r: Reply) => (r?.reply_markup?.keyboard ?? []).flat().map((b) => b.text);
const tanggalUtc = (offsetHari: number) => new Date(Date.now() + offsetHari * 86400000).toISOString().slice(0, 10);

after(async () => {
  await prisma.telegramUpdate.deleteMany({ where: { id: { in: updateIds.map((x) => BigInt(x)) } } });
  await prisma.telegramConversation.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.kasTransaksi.deleteMany({ where: { pencatatId: { in: userIds } } });
  await prisma.tvSlide.deleteMany({ where: { id: { in: slideIds } } });
  await prisma.dana.deleteMany({ where: { id: { in: danaIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("catatan kas satu pesan: dana bawaan, #dana tanpa beda huruf, Ganti dana, dan menu satu langkah", async () => {
  const nonaktif = await prisma.dana.create({ data: { nama: `Dana Lama ${unique}`, aktif: false, urutan: 0 } });
  danaIds.push(nonaktif.id);
  const aktif = await prisma.dana.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }] });
  const zakat = aktif.find((d) => d.nama.toLowerCase() === "zakat");
  assert.ok(zakat, "test DB needs an active Zakat fund");
  const { user, send } = await buatPengguna("bendahara");

  // Satu pesan langsung jadi ringkasan; dana bawaan = dana aktif pertama.
  const ringkas = await send("+125rb infak hamba Allah");
  assert.match(ringkas!.text, /Pemasukan Rp125\.000/);
  assert.match(ringkas!.text, new RegExp(`Dana: ${aktif[0].nama}`));
  assert.deepEqual(tombol(ringkas), ["Simpan", "Ganti dana", "Batal"]);

  // Ganti dana: tombol hanya dana aktif, pilihan tanpa beda huruf.
  const pilih = await send("Ganti dana");
  assert.deepEqual(tombol(pilih), [...aktif.map((d) => d.nama), "Batal"]);
  assert.ok(!tombol(pilih).includes(nonaktif.nama));
  assert.match((await send("Dana Hantu"))!.text, /Pilih dana/);
  assert.match((await send("  ZAKAT "))!.text, new RegExp(`Dana: ${zakat.nama}`));
  assert.equal(await prisma.kasTransaksi.count({ where: { pencatatId: user.id } }), 0);
  const simpan = await send("Simpan");
  assert.match(simpan!.text, new RegExp(`Saldo dana ${zakat.nama} sekarang`));
  let rows = await prisma.kasTransaksi.findMany({ where: { pencatatId: user.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dana, zakat.nama);
  assert.equal(rows[0].jenis, "masuk");

  // #dana dan tanggal di pesan yang sama; dana nonaktif ditolak.
  assert.match((await send(`-50rb sabun #${nonaktif.nama.split(" ")[0]}`))!.text, /tidak ada/);
  const r2 = await send("-1,5jt servis ac #ZAK tgl 1");
  assert.match(r2!.text, /Pengeluaran Rp1\.500\.000/);
  assert.match(r2!.text, new RegExp(`Dana: ${zakat.nama}`));
  await send("Simpan");
  rows = await prisma.kasTransaksi.findMany({ where: { pencatatId: user.id, jenis: "keluar" } });
  assert.equal(rows[0].jumlah, 1500000);
  assert.equal(rows[0].tanggal.toISOString().slice(8, 10), "01");

  // Menu Pengeluaran: satu pertanyaan, tanpa tanda minus.
  assert.match((await send("Pengeluaran"))!.text, /satu pesan/);
  assert.match((await send("75rb konsumsi rapat"))!.text, /Pengeluaran Rp75\.000/);
  await send("Batal");
  assert.equal(await prisma.kasTransaksi.count({ where: { pencatatId: user.id } }), 2);

  // Pesan tidak terbaca memberi contoh, tidak menyimpan apa pun.
  assert.match((await send("+kotak jumat"))!.text, /Contoh/);

  const saldo = await send("Saldo");
  assert.match(saldo!.text, /Total: -?Rp[\d.]+/);
  const terakhir = await send("Transaksi terakhir");
  assert.match(terakhir!.text, /\d{2}\/\d{2}\/\d{4} \| (Masuk|Keluar) \| Rp/);
});

test("kajian flow stores speaker, place and event time converted from the mosque zone (WITA)", async () => {
  const lama = await prisma.pengaturan.findUnique({ where: { key: "lokasi_default" } });
  await prisma.pengaturan.upsert({ where: { key: "lokasi_default" }, create: { key: "lokasi_default", value: "Makassar" }, update: { value: "Makassar" } });
  try {
    const { user, send } = await buatPengguna("konten");
    const mulai = tanggalUtc(20);
    const selesai = tanggalUtc(30);
    const judul = `Kajian uji ${unique}`;
    assert.match((await send("Kajian"))!.text, /tema/);
    assert.match((await send(judul))!.text, /penceramah/);
    const tanyaWaktu = await send("Ustadz Penguji");
    assert.match(tanyaWaktu!.text, /WITA/);
    assert.match((await send("2026-13-01 19:30"))!.text, /Format waktu belum sesuai/);
    assert.match((await send(`${selesai} 19.30`))!.text, /tempatnya/);
    const tanyaMulai = await send("Aula lantai 2");
    assert.match(tanyaMulai!.text, /00\.00 WITA/);
    await send(mulai);
    assert.match((await send(tanggalUtc(10)))!.text, /setelah tanggal mulai/);
    const tanyaFoto = await send(selesai);
    assert.deepEqual(tombol(tanyaFoto), ["Lewati", "Batal"]);
    const ringkas = await send("Lewati");
    assert.match(ringkas!.text, /Penceramah: Ustadz Penguji/);
    assert.match(ringkas!.text, /pukul 19\.30 WITA/);
    assert.deepEqual(tombol(ringkas), ["Simpan", "Koreksi", "Batal"]);

    const simpanId = ++updateId;
    await send("Simpan", simpanId);
    await send("Simpan", simpanId);
    const rows = await prisma.tvSlide.findMany({ where: { judul } });
    slideIds.push(...rows.map((r) => r.id));
    assert.equal(rows.length, 1);
    const s = rows[0];
    assert.equal(s.jenis, "kajian");
    assert.equal(s.penceramah, "Ustadz Penguji");
    assert.equal(s.lokasi, "Aula lantai 2");
    assert.equal(s.isi, null);
    assert.equal(s.waktuKegiatan!.toISOString(), `${selesai}T11:30:00.000Z`);
    assert.equal(s.mulai.toISOString(), new Date(`${mulai}T00:00:00+08:00`).toISOString());
    assert.equal(s.selesai.toISOString(), new Date(`${selesai}T23:59:59+08:00`).toISOString());
    assert.equal(s.durasi, 15);
    assert.equal(s.urutan, 0);
    assert.equal(s.aktif, true);
    const audit = await prisma.auditLog.findMany({ where: { actorId: user.id, entity: "tv", entityId: s.id } });
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, "create");
  } finally {
    if (lama) await prisma.pengaturan.update({ where: { key: "lokasi_default" }, data: { value: lama.value } });
    else await prisma.pengaturan.deleteMany({ where: { key: "lokasi_default" } });
  }
});

test("pengumuman uses WIB by default; galeri requires a photo and rejects photos over 4 MB", async () => {
  const lama = await prisma.pengaturan.findUnique({ where: { key: "lokasi_default" } });
  await prisma.pengaturan.upsert({ where: { key: "lokasi_default" }, create: { key: "lokasi_default", value: "Jakarta" }, update: { value: "Jakarta" } });
  try {
    const { user, send } = await buatPengguna("pengurus");
    await send("Galeri");
    await send(`Galeri uji ${unique}`);
    const tanyaMulai = await send("Lewati");
    assert.match(tanyaMulai!.text, /00\.00 WIB/);
    await send("Hari ini");
    const tanyaFoto = await send(tanggalUtc(5));
    assert.deepEqual(tombol(tanyaFoto), ["Batal"]);
    assert.match((await send("Lewati"))!.text, /Foto wajib/);
    const besar = await send("", ++updateId, { photo: [{ file_id: "x", file_size: 6 * 1024 * 1024 }] });
    assert.match(besar!.text, /maksimal 4 MB/);
    const conv = await prisma.telegramConversation.findUnique({ where: { userId: user.id } });
    assert.equal(conv!.state, "galeri:foto");
    assert.equal(await prisma.tvSlide.count({ where: { judul: `Galeri uji ${unique}` } }), 0);
  } finally {
    if (lama) await prisma.pengaturan.update({ where: { key: "lokasi_default" }, data: { value: lama.value } });
    else await prisma.pengaturan.deleteMany({ where: { key: "lokasi_default" } });
  }
});

test("Kelola tayangan edits the end date and deactivates a slide with audit trail", async () => {
  const { user, send } = await buatPengguna("konten");
  const slide = await prisma.tvSlide.create({ data: { jenis: "pengumuman", judul: `Pengumuman kelola ${unique} dengan judul yang cukup panjang sekali`, isi: "Isi lama", mulai: new Date("2000-01-01T00:00:00Z"), selesai: new Date(Date.now() + 5 * 86400000) } });
  slideIds.push(slide.id);

  const daftar = await send("Kelola tayangan");
  const pilihan = tombol(daftar).find((t) => t.includes(`Pengumuman kelola ${unique}`.slice(0, 30)));
  assert.ok(pilihan, "slide should be listed");
  assert.match(pilihan!, /^1\. .+\.\.\. \(Sedang tayang\)$/);
  assert.ok(tombol(daftar).length <= 11);

  const aksi = await send(pilihan!);
  assert.deepEqual(tombol(aksi), ["Ubah judul", "Ubah keterangan", "Ubah akhir tayang", "Nonaktifkan", "Batal"]);

  await send("Ubah akhir tayang");
  assert.match((await send("1999-12-31"))!.text, /tidak boleh sebelum awal tayang/);
  assert.match((await send("2001-01-01"))!.text, /hari ini atau setelahnya/);
  const baru = tanggalUtc(40);
  const konfirmasi = await send(baru);
  assert.match(konfirmasi!.text, /Sebelum: .+\nSesudah: /);
  assert.deepEqual(tombol(konfirmasi), ["Simpan", "Batal"]);
  await send("Simpan");
  const diubah = await prisma.tvSlide.findUniqueOrThrow({ where: { id: slide.id } });
  assert.equal(diubah.selesai.toISOString(), new Date(`${baru}T23:59:59+07:00`).toISOString());

  await send("Kelola tayangan");
  await send("1");
  await send("Nonaktifkan");
  assert.equal((await prisma.tvSlide.findUniqueOrThrow({ where: { id: slide.id } })).aktif, true);
  await send("Simpan");
  assert.equal((await prisma.tvSlide.findUniqueOrThrow({ where: { id: slide.id } })).aktif, false);

  const audits = await prisma.auditLog.findMany({ where: { actorId: user.id, entityId: slide.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(audits.map((a) => a.action), ["update", "deactivate"]);
  assert.equal(JSON.parse(audits[1].before!).aktif, true);
  assert.equal(JSON.parse(audits[1].after!).aktif, false);
  assert.equal(audits[0].entity, "tv");

  const kosong = await send("Kelola tayangan");
  assert.ok(!tombol(kosong).some((t) => t.includes(`Pengumuman kelola ${unique}`.slice(0, 30))));
});

test("roles are separated, unknown users get no data, expired sessions are dropped", async () => {
  const konten = await buatPengguna("konten");
  const bendahara = await buatPengguna("bendahara");

  const menuKonten = tombol(await konten.send("/start"));
  assert.ok(menuKonten.includes("Kelola tayangan"));
  assert.ok(!menuKonten.includes("Saldo"));
  assert.match((await konten.send("Saldo"))!.text, /hanya untuk bendahara/);
  assert.match((await konten.send("Transaksi terakhir"))!.text, /hanya untuk bendahara/);
  assert.match((await konten.send("Pemasukan"))!.text, /tidak memiliki akses/);

  const menuBendahara = tombol(await bendahara.send("/menu"));
  assert.ok(menuBendahara.includes("Saldo"));
  assert.ok(!menuBendahara.includes("Kajian"));
  assert.match((await bendahara.send("Kajian"))!.text, /tidak memiliki akses/);
  assert.match((await bendahara.send("Kelola tayangan"))!.text, /tidak memiliki akses/);

  // Konten tidak bisa mencatat kas lewat pesan cepat.
  assert.match((await konten.send("+300rb kotak jumat"))!.text, /hanya untuk bendahara/);

  // Role dicabut di tengah alur: simpan ditolak.
  await bendahara.send("-50rb air");
  await prisma.user.update({ where: { id: bendahara.user.id }, data: { role: "konten" } });
  assert.match((await bendahara.send("Simpan"))!.text, /Hak akses/);
  assert.equal(await prisma.kasTransaksi.count({ where: { pencatatId: bendahara.user.id } }), 0);

  const asingId = 690000000 + Math.floor(Math.random() * 1000000);
  updateIds.push(++updateId);
  const asing = await processTelegram({ update_id: updateId, message: { from: { id: asingId }, chat: { id: asingId, type: "private" }, text: "Saldo" } });
  assert.match(asing!.text, /belum terdaftar/);
  assert.doesNotMatch(asing!.text, /Rp/);

  await konten.send("Pengumuman");
  await prisma.telegramConversation.update({ where: { userId: konten.user.id }, data: { updatedAt: new Date(Date.now() - 25 * 3600000) } });
  assert.match((await konten.send("Judul basi"))!.text, /24 jam/);
  assert.equal(await prisma.telegramConversation.count({ where: { userId: konten.user.id } }), 0);
});
