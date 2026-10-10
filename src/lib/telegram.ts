import { z } from "zod";
import type { Prisma, TvSlide } from "@prisma/client";
import prisma from "./prisma";
import { canContent, canFinance } from "./permissions";
import { createTransaction } from "./finance";
import { simpanUnggahan } from "./upload";
import { tanggalKalender } from "./validasi";
import { danaResmi, zonaMasjid } from "./data-kas";
import { hitungLaporan } from "./laporan-kas";
import { nilaiInputTanggal } from "./format";
import { LABEL_ZONA, type Zona } from "./kota";
import { LABEL_JENIS, LABEL_STATUS, dataSlide, slideSchema, statusSlide } from "./tv";
import { bacaCatatanCepat } from "./catat-cepat";

const photoSchema = z.object({ file_id: z.string(), file_size: z.number().optional() });
export const updateSchema = z.object({
  update_id: z.number().int(),
  message: z.object({
    from: z.object({ id: z.number().int() }),
    chat: z.object({ id: z.number().int(), type: z.string() }),
    text: z.string().max(4096).optional(),
    caption: z.string().max(1024).optional(),
    photo: z.array(photoSchema).optional(),
  }).optional(),
});
type Update = z.infer<typeof updateSchema>;
type Draft = Record<string, string>;
type Tx = Prisma.TransactionClient;

const MAKS_FOTO = 4 * 1024 * 1024;
const SEHARI = 86400000;

export async function telegramCall(method: string, payload: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram belum dikonfigurasi");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Permintaan Telegram gagal");
  return result.result;
}

/** Unduh foto Telegram. Bukti transaksi ke folder "bukti", gambar tayangan ke "tayangan". */
async function downloadPhoto(fileId: string, privateReceipt: boolean) {
  const result = await telegramCall("getFile", { file_id: fileId });
  if (!result.file_path || result.file_size > MAKS_FOTO) throw new Error("Foto maksimal 4 MB.");
  const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${result.file_path}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Foto tidak dapat diunduh. Coba kirim ulang.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAKS_FOTO) throw new Error("Foto maksimal 4 MB.");
  const saved = await simpanUnggahan(new File([bytes], "telegram.jpg"), privateReceipt ? "bukti" : "tayangan");
  if (!saved.ok) throw new Error(saved.pesan);
  return saved.berkas.url;
}

/* ------------------------------ Zona waktu ------------------------------ */

/** Indonesia tidak memakai musim panas, jadi selisih tiap zona tetap. */
const OFFSET_ZONA: Record<Zona, string> = {
  "Asia/Jakarta": "+07:00",
  "Asia/Makassar": "+08:00",
  "Asia/Jayapura": "+09:00",
};
const singkatanZona = (zona: Zona) => LABEL_ZONA[zona].split(" ")[0];
const awalHari = (tanggal: string, zona: Zona) => new Date(`${tanggal}T00:00:00${OFFSET_ZONA[zona]}`);
const akhirHari = (tanggal: string, zona: Zona) => new Date(`${tanggal}T23:59:59${OFFSET_ZONA[zona]}`);
/** "YYYY-MM-DD HH:MM" waktu masjid menjadi instan UTC. */
const waktuKeDate = (waktu: string, zona: Zona) => new Date(`${waktu.replace(" ", "T")}:00${OFFSET_ZONA[zona]}`);

function jamLokal(nilai: Date, zona: Zona) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(nilai);
}

/** "2026-10-10" menjadi "10/10/2026". */
function tampilTanggal(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function rupiah(nilai: number) {
  return `${nilai < 0 ? "-" : ""}Rp${Math.abs(nilai).toLocaleString("id-ID")}`;
}

function potong(teks: string, maks: number) {
  return teks.length > maks ? `${teks.slice(0, maks - 3).trimEnd()}...` : teks;
}

/** Terima "YYYY-MM-DD HH:MM" (atau HH.MM), kembalikan bentuk baku atau null. */
function bacaWaktu(teks: string) {
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})[:.](\d{2})$/.exec(teks);
  if (!m || !tanggalKalender.safeParse(m[1]).success) return null;
  const jam = Number(m[2]);
  const menit = Number(m[3]);
  if (jam > 23 || menit > 59) return null;
  return `${m[1]} ${String(jam).padStart(2, "0")}:${m[3]}`;
}

/* ------------------------------ Alur input ------------------------------ */

const FLOW: Record<string, string[]> = {
  kajian: ["judul", "penceramah", "waktu", "lokasi", "mulai", "selesai", "foto"],
  pengumuman: ["judul", "isi", "mulai", "selesai", "foto"],
  galeri: ["judul", "isi", "mulai", "selesai", "foto"],
};
// Kas dicatat lewat alur cepat ("cepat:isi" / "cepat:confirm" / "cepat:dana").
const KEUANGAN = ["cepat"];

/** Pesan yang tampak seperti catatan kas satu baris: diawali + atau -. */
const polaCepat = /^[+-]\s*(rp\.?\s*)?\d/i;

const CONTOH_CEPAT = "Contoh:\n+300rb kotak jumat\n-150rb listrik\n-1,2jt semen #pembangunan kemarin\n\n+ pemasukan, - pengeluaran. Dana bawaan Operasional (tulis #nama untuk dana lain), tanggal bawaan hari ini. Ada nota? Kirim fotonya dengan tulisan itu sebagai caption.";
const BATAS_TEKS: Record<string, number> = { judul: 160, isi: 2000, penceramah: 120, lokasi: 160, keterangan: 200, kategori: 80 };

const PILIHAN_MENU: Record<string, string> = {
  Kajian: "kajian",
  Pengumuman: "pengumuman",
  Galeri: "galeri",
  "Kelola tayangan": "kelola",
};

function teksPertanyaan(type: string, field: string, zona: Zona): string {
  const z = singkatanZona(zona);
  const khusus: Record<string, string> = {
    "kajian:judul": "Apa tema kajiannya?",
    "kajian:foto": "Kirim poster kajian (maksimal 4 MB), atau pilih Lewati.",
    "pengumuman:judul": "Apa judul pengumumannya?",
    "pengumuman:isi": "Tulis isi pengumumannya.",
    "pengumuman:foto": "Kirim gambar pendukung (maksimal 4 MB), atau pilih Lewati.",
    "galeri:judul": "Apa judul fotonya? Misalnya Kerja bakti Ahad pagi.",
    "galeri:isi": "Tambahkan keterangan singkat untuk foto ini, atau pilih Lewati.",
    "galeri:foto": "Kirim fotonya. Foto wajib untuk galeri, maksimal 4 MB.",
  };
  const umum: Record<string, string> = {
    penceramah: "Siapa penceramahnya? Misalnya Ustadz Ahmad Fauzi.",
    waktu: `Kapan kajiannya? Tulis tanggal dan jam ${z} dengan format YYYY-MM-DD HH:MM, misalnya 2026-10-17 19:30.`,
    lokasi: "Di mana tempatnya? Misalnya Ruang utama masjid.",
    mulai: `Mulai tayang tanggal berapa? Format YYYY-MM-DD. Tayangan muncul sejak pukul 00.00 ${z}. Bisa juga pilih Hari ini.`,
    selesai: `Sampai tanggal berapa ditayangkan? Format YYYY-MM-DD. Tayangan berhenti pukul 23.59 ${z} pada tanggal itu.`,
  };
  return khusus[`${type}:${field}`] ?? umum[field] ?? "Lanjutkan.";
}

const LABEL_FIELD: Record<string, string> = {
  judul: "Judul", penceramah: "Penceramah", waktu: "Waktu kegiatan", lokasi: "Lokasi", isi: "Keterangan",
  mulai: "Mulai tayang", selesai: "Selesai tayang", foto: "Foto",
};

function ringkasanDraft(type: string, draft: Draft, zona: Zona) {
  const z = singkatanZona(zona);
  const judul = LABEL_JENIS[type as keyof typeof LABEL_JENIS];
  const baris = FLOW[type].map((field) => {
    const v = draft[field] ?? "";
    let tampil = v;
    if (field === "mulai") tampil = `${tampilTanggal(v)} pukul 00.00 ${z}`;
    else if (field === "selesai") tampil = `${tampilTanggal(v)} pukul 23.59 ${z}`;
    else if (field === "waktu") tampil = `${tampilTanggal(v.slice(0, 10))} pukul ${v.slice(11).replace(":", ".")} ${z}`;
    else if (field === "foto") tampil = v ? "Terlampir" : "Tidak ada";
    else if (!v) tampil = "-";
    return `${LABEL_FIELD[field]}: ${tampil}`;
  });
  return `Periksa dulu ${judul.toLowerCase()} berikut:\n${baris.join("\n")}\n\nPilih Simpan jika sudah benar, Koreksi untuk mengisi ulang, atau Batal.`;
}

async function danaAktif(tx: Tx) {
  return (await tx.dana.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { nama: true } })).map((d) => d.nama);
}

/** Ringkasan catatan kas cepat sebelum disimpan. */
function ringkasanCepat(d: Draft, hariIni: string) {
  const baris = [
    `${d.jenis === "masuk" ? "Pemasukan" : "Pengeluaran"} ${rupiah(Number(d.jumlah))}`,
    d.keterangan,
    `Dana: ${d.dana}`,
    ...(d.kategori ? [`Kategori: ${d.kategori}`] : []),
    `Tanggal: ${tampilTanggal(d.tanggal)}${d.tanggal === hariIni ? " (hari ini)" : ""}`,
    `Nota: ${d.foto ? "terlampir" : "tidak ada (kirim foto untuk melampirkan)"}`,
  ];
  return `${baris.join("\n")}\n\nSimpan?`;
}

/* --------------------------- Proses satu update -------------------------- */

export async function processTelegram(update: Update) {
  const handled = await prisma.telegramUpdate.findUnique({ where: { id: BigInt(update.update_id) } });
  if (handled) return handled.sent || !handled.reply ? null : JSON.parse(handled.reply);
  const message = update.message;
  if (!message || message.chat.type !== "private" || message.chat.id !== message.from.id) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: String(message.from.id) } });
  if (!user || (!canFinance(user.role) && !canContent(user.role))) return { chat_id: message.chat.id, text: `Akun Telegram ini belum terdaftar. Minta admin menautkan ID Telegram ${message.from.id} ke akun pengurus.` };
  const zona = await zonaMasjid();

  let photo: string | undefined;
  let photoError: string | undefined;
  const existing = await prisma.telegramConversation.findUnique({ where: { userId: user.id } });
  // Foto hanya diunduh bila percakapan memang sedang menunggu foto, belum
  // kedaluwarsa, dan peran masih mengizinkan, supaya tidak ada berkas yatim.
  const jenisMenunggu = existing?.state.split(":")[0] ?? "";
  const masihBerlaku = !!existing && Date.now() - existing.updatedAt.getTime() <= SEHARI;
  const perannyaBoleh = KEUANGAN.includes(jenisMenunggu) ? canFinance(user.role) : canContent(user.role);
  const fotoCatatanCepat = !!message.photo?.length && polaCepat.test(message.caption?.trim() ?? "") && canFinance(user.role);
  const fotoUntukCepat = !!existing && /^cepat:(isi|confirm)$/.test(existing.state) && !!message.photo?.length && masihBerlaku && canFinance(user.role);
  const fotoUntukAlur = !!existing?.state.endsWith(":foto") && !!message.photo?.length && masihBerlaku && perannyaBoleh;
  if (message.photo?.length && (fotoCatatanCepat || fotoUntukCepat || fotoUntukAlur)) {
    const terbesar = message.photo[message.photo.length - 1];
    if ((terbesar.file_size ?? 0) > MAKS_FOTO) photoError = "Foto maksimal 4 MB.";
    else {
      try {
        photo = await downloadPhoto(terbesar.file_id, fotoCatatanCepat || fotoUntukCepat);
      } catch (error) {
        photoError = error instanceof Error ? error.message : "Foto gagal diproses.";
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    if (await tx.telegramUpdate.findUnique({ where: { id: BigInt(update.update_id) } })) return null;
    await tx.telegramUpdate.create({ data: { id: BigInt(update.update_id) } });
    const text = (message.text ?? message.caption ?? "").trim();
    const now = new Date();
    const hariIni = nilaiInputTanggal(now, zona);
    const bolehKeuangan = canFinance(user.role);
    const bolehKonten = canContent(user.role);
    const menu = [
      ...(bolehKeuangan ? ["Pemasukan", "Pengeluaran", "Saldo", "Transaksi terakhir"] : []),
      ...(bolehKonten ? ["Kajian", "Pengumuman", "Galeri", "Kelola tayangan"] : []),
      "Batal",
    ];

    const reply = async (isi: string, tombol: string[] = menu, kolom = tombol === menu ? 2 : 1) => {
      const keyboard: { text: string }[][] = [];
      for (let i = 0; i < tombol.length; i += kolom) keyboard.push(tombol.slice(i, i + kolom).map((t) => ({ text: t })));
      const payload = { chat_id: message.chat.id, text: isi, reply_markup: { keyboard, resize_keyboard: true } };
      await tx.telegramUpdate.update({ where: { id: BigInt(update.update_id) }, data: { reply: JSON.stringify(payload) } });
      return payload;
    };
    const simpanState = (state: string, data: Draft) =>
      tx.telegramConversation.upsert({ where: { userId: user.id }, create: { userId: user.id, state, data: JSON.stringify(data) }, update: { state, data: JSON.stringify(data) } });
    const akhiriSesi = () => tx.telegramConversation.deleteMany({ where: { userId: user.id } });

    /** Kirim pertanyaan untuk langkah berikutnya beserta tombol yang sesuai. */
    const tanya = async (type: string, field: string, awalan = "") => {
      const pesan = awalan ? `${awalan}\n\n${teksPertanyaan(type, field, zona)}` : teksPertanyaan(type, field, zona);
      if (field === "mulai") return reply(pesan, ["Hari ini", "Batal"]);
      if (field === "foto") return reply(pesan, type === "galeri" ? ["Batal"] : ["Lewati", "Batal"]);
      if (field === "isi" && type === "galeri") return reply(pesan, ["Lewati", "Batal"]);
      return reply(pesan, ["Batal"]);
    };

    if (["/start", "/menu", "Menu", "Batal", "/batal"].includes(text)) {
      await akhiriSesi();
      if (text === "Batal" || text === "/batal") return reply("Dibatalkan. Tidak ada data yang disimpan.");
      return reply(`Assalamu'alaikum. Silakan pilih menu.${bolehKeuangan ? `\n\nMencatat kas cukup satu pesan.\n${CONTOH_CEPAT}` : ""}`);
    }

    /* ------------------------------ Keuangan ------------------------------ */
    if (text === "Saldo" || text === "Transaksi terakhir") {
      if (!bolehKeuangan) return reply("Menu keuangan hanya untuk bendahara dan admin.");
      if (text === "Saldo") {
        const rows = await tx.kasTransaksi.findMany({
          where: { deletedAt: null, tanggal: { lte: new Date(`${hariIni}T00:00:00.000Z`) } },
          select: { id: true, tanggal: true, jenis: true, jumlah: true, dana: true, kategori: true, keterangan: true },
        });
        const lap = hitungLaporan(rows, { dari: "0001-01-01", sampai: hariIni, dana: "", kategori: "", jenis: "", q: "" });
        const perDana = lap.saldoPerDana.map((d) => `${d.dana}: ${rupiah(d.saldo)}`).join("\n");
        return reply(`Saldo kas per ${tampilTanggal(hariIni)}\nTotal: ${rupiah(lap.ringkasan.saldoAkhir)}${perDana ? `\n\nPer dana:\n${perDana}` : "\n\nBelum ada transaksi."}`);
      }
      const rows = await tx.kasTransaksi.findMany({ where: { deletedAt: null }, orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }], take: 10 });
      if (!rows.length) return reply("Belum ada transaksi.");
      const baris = rows.map((r) => `${tampilTanggal(r.tanggal.toISOString().slice(0, 10))} | ${r.jenis === "masuk" ? "Masuk" : "Keluar"} | ${rupiah(r.jumlah)} | ${r.dana} | ${r.keterangan}`);
      return reply(`10 transaksi terakhir:\n${baris.join("\n")}`);
    }

    /* ---------------------------- Kelola tayangan --------------------------- */
    const tampilkanDaftar = async (awalan = "") => {
      const slides = await tx.tvSlide.findMany({ where: { aktif: true, selesai: { gt: now } }, orderBy: [{ mulai: "asc" }, { createdAt: "asc" }], take: 10 });
      if (!slides.length) {
        await akhiriSesi();
        return reply(`${awalan ? `${awalan}\n\n` : ""}Belum ada tayangan aktif yang bisa dikelola.`);
      }
      await simpanState("kelola:pilih", { ids: slides.map((s) => s.id).join(",") });
      const tombol = slides.map((s, i) => `${i + 1}. ${potong(s.judul, 40)} (${LABEL_STATUS[statusSlide(s, now)]})`);
      return reply(`${awalan ? `${awalan}\n\n` : ""}Pilih tayangan yang ingin diubah atau dinonaktifkan:`, [...tombol, "Batal"]);
    };
    const detailSlide = (s: TvSlide) => {
      const z = singkatanZona(zona);
      return [
        `${LABEL_JENIS[s.jenis as keyof typeof LABEL_JENIS] ?? s.jenis}: ${s.judul}`,
        `Status: ${LABEL_STATUS[statusSlide(s, now)]}`,
        `Tayang: ${tampilTanggal(nilaiInputTanggal(s.mulai, zona))} ${jamLokal(s.mulai, zona)} sampai ${tampilTanggal(nilaiInputTanggal(s.selesai, zona))} ${jamLokal(s.selesai, zona)} ${z}`,
        `Keterangan: ${s.isi ? potong(s.isi, 200) : "-"}`,
      ].join("\n");
    };
    const AKSI_KELOLA = ["Ubah judul", "Ubah keterangan", "Ubah akhir tayang", "Nonaktifkan", "Batal"];
    const slideAktif = (id: string) => tx.tvSlide.findFirst({ where: { id, aktif: true, selesai: { gt: now } } });
    /** Validasi tanggal akhir tayang baru terhadap awal tayang slide dan hari ini. */
    const cekAkhirTayang = (nilai: string, slide: TvSlide) => {
      if (!tanggalKalender.safeParse(nilai).success) return "Tanggal tidak valid. Gunakan format YYYY-MM-DD, misalnya 2026-10-31.";
      const awal = nilaiInputTanggal(slide.mulai, zona);
      if (nilai < awal) return `Tanggal akhir tayang tidak boleh sebelum awal tayang (${tampilTanggal(awal)}).`;
      if (akhirHari(nilai, zona) <= now || nilai < hariIni) return "Tanggal akhir tayang harus hari ini atau setelahnya.";
      return null;
    };

    /* ------------------------- Catatan kas cepat ------------------------- */
    const kategoriAda = async () =>
      (await tx.kasTransaksi.findMany({ where: { deletedAt: null, kategori: { not: null } }, distinct: ["kategori"], select: { kategori: true } }))
        .map((r) => r.kategori!).filter(Boolean);
    const catatCepat = async (isi: string, jenisBawaan?: "masuk" | "keluar") => {
      const hasil = bacaCatatanCepat(isi, { hariIni, danaAktif: await danaAktif(tx), kategori: await kategoriAda(), jenisBawaan });
      if (!hasil.ok) return reply(`${hasil.pesan}\n\n${CONTOH_CEPAT}`, ["Batal"]);
      const c = hasil.catatan;
      const draft: Draft = { jenis: c.jenis, jumlah: String(c.jumlah), keterangan: c.keterangan, dana: c.dana, kategori: c.kategori ?? "", tanggal: c.tanggal, foto: photo ?? "" };
      await simpanState("cepat:confirm", draft);
      return reply(`${photoError ? `Foto belum bisa dilampirkan: ${photoError}\n\n` : ""}${ringkasanCepat(draft, hariIni)}`, ["Simpan", "Ganti dana", "Batal"], 3);
    };
    if (polaCepat.test(text)) {
      if (!bolehKeuangan) return reply("Pencatatan kas hanya untuk bendahara dan admin.");
      return catatCepat(text);
    }

    const kind = PILIHAN_MENU[text];
    if (text === "Pemasukan" || text === "Pengeluaran") {
      if (!bolehKeuangan) return reply("Peran Anda tidak memiliki akses ke menu ini.");
      const jenis = text === "Pemasukan" ? "masuk" : "keluar";
      await simpanState("cepat:isi", { jenisBawaan: jenis });
      return reply(`Tulis nominal dan keterangannya dalam satu pesan, misalnya:\n${jenis === "masuk" ? "300rb kotak jumat" : "150rb bayar listrik"}\n\nTambahkan #nama untuk dana selain Operasional, atau kemarin / tgl 5 untuk tanggal lain. Ada nota? Kirim fotonya dengan tulisan itu sebagai caption.`, ["Batal"]);
    }
    if (kind) {
      if (!bolehKonten) return reply("Peran Anda tidak memiliki akses ke menu ini.");
      if (kind === "kelola") return tampilkanDaftar();
      await simpanState(`${kind}:${FLOW[kind][0]}`, {});
      return tanya(kind, FLOW[kind][0]);
    }

    const conversation = await tx.telegramConversation.findUnique({ where: { userId: user.id } });
    if (!conversation) return reply(bolehKeuangan ? `Pilih menu, atau catat kas langsung dengan satu pesan.\n${CONTOH_CEPAT}` : "Pilih menu untuk memulai.");
    if (Date.now() - conversation.updatedAt.getTime() > SEHARI) {
      await akhiriSesi();
      return reply("Sesi sebelumnya sudah lebih dari 24 jam dan dibatalkan tanpa menyimpan data. Pilih menu untuk mulai lagi.");
    }
    const [type, field] = conversation.state.split(":");
    if (KEUANGAN.includes(type) ? !bolehKeuangan : !bolehKonten) {
      await akhiriSesi();
      return reply("Hak akses Anda berubah sehingga catatan ini tidak dapat dilanjutkan. Hubungi admin bila perlu.");
    }
    const draft: Draft = JSON.parse(conversation.data);
    // Klaim percakapan secara atomik sebelum menyimpan: hanya permintaan yang
    // berhasil menghapus baris percakapan versi ini yang boleh menulis. Dua
    // ketukan "Simpan" (update_id berbeda) yang diproses bersamaan tidak akan
    // menghasilkan dua catatan, juga di PostgreSQL.
    const klaim = async () =>
      (await tx.telegramConversation.deleteMany({ where: { userId: user.id, state: conversation.state, updatedAt: conversation.updatedAt } })).count === 1;
    const sudahDiproses = () => reply("Catatan ini sudah diproses. Pilih menu untuk memulai catatan baru.");

    if (type === "cepat") {
      if (field === "isi") {
        if (message.photo?.length && !text) return reply("Tulis nominal dan keterangannya di caption foto, misalnya: 150rb bayar listrik.", ["Batal"]);
        return catatCepat(text, draft.jenisBawaan === "keluar" ? "keluar" : "masuk");
      }
      if (field === "dana") {
        const dana = text ? await danaResmi(text, tx) : null;
        if (!dana) return reply("Pilih dana dari tombol di bawah.", [...(await danaAktif(tx)), "Batal"], 2);
        draft.dana = dana;
        await simpanState("cepat:confirm", draft);
        return reply(ringkasanCepat(draft, hariIni), ["Simpan", "Ganti dana", "Batal"], 3);
      }
      // field === "confirm"
      if (message.photo?.length) {
        if (photoError || !photo) return reply(`Foto belum bisa dilampirkan: ${photoError ?? "coba kirim ulang"}.\n\n${ringkasanCepat(draft, hariIni)}`, ["Simpan", "Ganti dana", "Batal"], 3);
        draft.foto = photo;
        await simpanState("cepat:confirm", draft);
        return reply(`Nota terlampir.\n\n${ringkasanCepat(draft, hariIni)}`, ["Simpan", "Ganti dana", "Batal"], 3);
      }
      if (text === "Ganti dana") {
        await simpanState("cepat:dana", draft);
        return reply("Pilih dananya:", [...(await danaAktif(tx)), "Batal"], 2);
      }
      if (text !== "Simpan") return reply(`Pilih Simpan, Ganti dana, atau Batal. Bisa juga kirim catatan baru seperti +300rb kotak jumat.\n\n${ringkasanCepat(draft, hariIni)}`, ["Simpan", "Ganti dana", "Batal"], 3);
      const dana = await danaResmi(draft.dana ?? "", tx);
      if (!dana) {
        await simpanState("cepat:dana", draft);
        return reply(`Dana "${draft.dana}" sudah tidak aktif. Pilih dana lain:`, [...(await danaAktif(tx)), "Batal"], 2);
      }
      if (!(await klaim())) return sudahDiproses();
      await createTransaction(tx, { tanggal: new Date(`${draft.tanggal}T00:00:00Z`), jenis: draft.jenis, jumlah: Number(draft.jumlah), keterangan: draft.keterangan, kategori: draft.kategori || null, dana, bukti: draft.foto || null }, user.id, "telegram");
      const total = await tx.kasTransaksi.groupBy({ by: ["jenis"], where: { dana, deletedAt: null }, _sum: { jumlah: true } });
      const saldo = total.reduce((s, r) => s + (r.jenis === "masuk" ? 1 : -1) * (r._sum.jumlah ?? 0), 0);
      await akhiriSesi();
      return reply(`Tersimpan: ${draft.jenis === "masuk" ? "pemasukan" : "pengeluaran"} ${rupiah(Number(draft.jumlah))}, ${draft.keterangan}. Saldo dana ${dana} sekarang ${rupiah(saldo)}.`);
    }

    if (type === "kelola") {
      if (field === "pilih") {
        const ids = (draft.ids ?? "").split(",").filter(Boolean);
        const nomor = /^(\d{1,2})(?:\.|$)/.exec(text);
        const id = nomor ? ids[Number(nomor[1]) - 1] : undefined;
        const slide = id ? await slideAktif(id) : null;
        if (!slide) return tampilkanDaftar(id ? "Tayangan itu sudah tidak aktif." : "Pilih nomor tayangan dari tombol yang tersedia.");
        await simpanState("kelola:aksi", { id: slide.id });
        return reply(`${detailSlide(slide)}\n\nApa yang ingin dilakukan?`, AKSI_KELOLA);
      }
      const slide = await slideAktif(draft.id ?? "");
      if (!slide) return tampilkanDaftar("Tayangan itu sudah tidak aktif atau sudah berakhir.");
      if (field === "aksi") {
        if (text === "Ubah judul") {
          await simpanState("kelola:judul", { id: slide.id });
          return reply(`Judul sekarang: ${slide.judul}\n\nTulis judul baru (maksimal 160 karakter).`, ["Batal"]);
        }
        if (text === "Ubah keterangan") {
          await simpanState("kelola:isi", { id: slide.id });
          return reply(`Keterangan sekarang: ${slide.isi || "-"}\n\nTulis keterangan baru (maksimal 2000 karakter), atau pilih Kosongkan untuk menghapusnya.`, ["Kosongkan", "Batal"]);
        }
        if (text === "Ubah akhir tayang") {
          await simpanState("kelola:selesai", { id: slide.id });
          return reply(`Akhir tayang sekarang: ${tampilTanggal(nilaiInputTanggal(slide.selesai, zona))}\n\nTulis tanggal akhir tayang baru dengan format YYYY-MM-DD. Tayangan berhenti pukul 23.59 ${singkatanZona(zona)} pada tanggal itu.`, ["Batal"]);
        }
        if (text === "Nonaktifkan") {
          await simpanState("kelola:confirm", { id: slide.id, aksi: "nonaktif" });
          return reply(`Nonaktifkan tayangan "${slide.judul}"?\nSebelum: ${LABEL_STATUS[statusSlide(slide, now)]}\nSesudah: Nonaktif, tidak muncul lagi di layar TV.\n\nPilih Simpan untuk menonaktifkan atau Batal.`, ["Simpan", "Batal"]);
        }
        return reply(`${detailSlide(slide)}\n\nPilih salah satu tindakan dari tombol.`, AKSI_KELOLA);
      }
      if (field === "judul" || field === "isi" || field === "selesai") {
        let nilai = text;
        let sebelum: string;
        let sesudah: string;
        if (field === "selesai") {
          const galat = cekAkhirTayang(text, slide);
          if (galat) return reply(galat, ["Batal"]);
          sebelum = tampilTanggal(nilaiInputTanggal(slide.selesai, zona));
          sesudah = tampilTanggal(text);
        } else {
          if (field === "isi" && text === "Kosongkan") nilai = "";
          else if (!text || text.length > BATAS_TEKS[field]) return reply(`Tulis teks antara 1 dan ${BATAS_TEKS[field]} karakter.`, field === "isi" ? ["Kosongkan", "Batal"] : ["Batal"]);
          sebelum = (field === "judul" ? slide.judul : slide.isi) || "-";
          sesudah = nilai || "-";
        }
        await simpanState("kelola:confirm", { id: slide.id, aksi: field, nilai });
        const label = field === "judul" ? "Judul" : field === "isi" ? "Keterangan" : "Akhir tayang";
        return reply(`Periksa perubahan ${label.toLowerCase()} untuk "${potong(slide.judul, 60)}":\nSebelum: ${sebelum}\nSesudah: ${sesudah}\n\nPilih Simpan untuk menyimpan perubahan atau Batal.`, ["Simpan", "Batal"]);
      }
      if (field === "confirm") {
        if (text !== "Simpan") return reply("Pilih Simpan untuk menyimpan perubahan atau Batal.", ["Simpan", "Batal"]);
        let data: Prisma.TvSlideUpdateInput;
        if (draft.aksi === "nonaktif") data = { aktif: false };
        else if (draft.aksi === "judul") data = { judul: draft.nilai };
        else if (draft.aksi === "isi") data = { isi: draft.nilai || null };
        else if (draft.aksi === "selesai") {
          const galat = cekAkhirTayang(draft.nilai, slide);
          if (galat) {
            await simpanState("kelola:selesai", { id: slide.id });
            return reply(`${galat}\n\nTulis tanggal akhir tayang yang baru.`, ["Batal"]);
          }
          data = { selesai: akhirHari(draft.nilai, zona) };
        } else return tampilkanDaftar("Pilihan tidak dikenali.");
        if (!(await klaim())) return sudahDiproses();
        const after = await tx.tvSlide.update({ where: { id: slide.id }, data });
        await tx.auditLog.create({ data: { actorId: user.id, entity: "tv", entityId: slide.id, action: draft.aksi === "nonaktif" ? "deactivate" : "update", before: JSON.stringify(slide), after: JSON.stringify(after) } });
        await akhiriSesi();
        return reply(draft.aksi === "nonaktif" ? "Tayangan dinonaktifkan dan tidak akan muncul lagi di layar TV." : "Perubahan tersimpan dan langsung berlaku di layar TV.");
      }
      await akhiriSesi();
      return reply("Pilih menu untuk memulai.");
    }

    if (!FLOW[type]) {
      await akhiriSesi();
      return reply("Pilih menu untuk memulai.");
    }

    /* ------------------------- Konfirmasi catatan baru ------------------------ */
    if (field === "confirm") {
      if (text === "Koreksi") {
        await simpanState(`${type}:${FLOW[type][0]}`, {});
        return tanya(type, FLOW[type][0], "Silakan isi ulang dari awal.");
      }
      if (text !== "Simpan") return reply("Periksa catatan di atas, lalu pilih Simpan, Koreksi, atau Batal.", ["Simpan", "Koreksi", "Batal"]);
      if (akhirHari(draft.selesai, zona) <= now) return reply("Tanggal selesai tayang sudah lewat. Pilih Koreksi untuk mengisi ulang.", ["Koreksi", "Batal"]);
      const parsed = slideSchema.safeParse({
        jenis: type,
        judul: draft.judul,
        isi: draft.isi || null,
        gambar: draft.foto || null,
        penceramah: type === "kajian" ? draft.penceramah : null,
        waktuKegiatan: type === "kajian" && draft.waktu ? waktuKeDate(draft.waktu, zona).toISOString() : null,
        lokasi: type === "kajian" ? draft.lokasi : null,
        mulai: awalHari(draft.mulai, zona).toISOString(),
        selesai: akhirHari(draft.selesai, zona).toISOString(),
        durasi: 15,
        urutan: 0,
        aktif: true,
      });
      if (!parsed.success) return reply(`Data belum bisa disimpan: ${parsed.error.issues[0]?.message ?? "isian tidak valid"}. Pilih Koreksi untuk mengisi ulang.`, ["Koreksi", "Batal"]);
      if (!(await klaim())) return sudahDiproses();
      const row = await tx.tvSlide.create({ data: dataSlide(parsed.data) });
      await tx.auditLog.create({ data: { actorId: user.id, entity: "tv", entityId: row.id, action: "create", after: JSON.stringify(row) } });
      await akhiriSesi();
      return reply(`Tersimpan. ${LABEL_JENIS[type as keyof typeof LABEL_JENIS]} "${potong(row.judul, 60)}" akan tayang mulai ${tampilTanggal(draft.mulai)}.`);
    }

    /* --------------------------- Validasi tiap langkah ------------------------ */
    const ulang = (pesan: string) => tanya(type, field, pesan);
    if (field === "mulai") {
      const nilai = text === "Hari ini" ? hariIni : text;
      if (!tanggalKalender.safeParse(nilai).success) return ulang("Tanggal tidak valid. Gunakan format YYYY-MM-DD, misalnya 2026-10-10.");
      draft[field] = nilai;
    } else if (field === "selesai") {
      if (!tanggalKalender.safeParse(text).success) return ulang("Tanggal tidak valid. Gunakan format YYYY-MM-DD, misalnya 2026-10-31.");
      if (text < draft.mulai) return ulang(`Tanggal selesai harus sama atau setelah tanggal mulai (${tampilTanggal(draft.mulai)}).`);
      if (text < hariIni) return ulang("Tanggal selesai sudah lewat. Tulis tanggal hari ini atau setelahnya.");
      draft.selesai = text;
    } else if (field === "waktu") {
      const waktu = bacaWaktu(text);
      if (!waktu) return ulang("Format waktu belum sesuai.");
      draft.waktu = waktu;
    } else if (field === "foto") {
      if (photoError) return ulang(photoError);
      if (photo) draft.foto = photo;
      else if (text === "Lewati" && type !== "galeri") draft.foto = "";
      else return ulang(type === "galeri" ? "Foto wajib untuk galeri. Kirim satu foto." : "Kirim foto, atau pilih Lewati.");
    } else if (field === "isi" && type === "galeri" && text === "Lewati") {
      draft.isi = "";
    } else {
      const batas = BATAS_TEKS[field] ?? 80;
      if (!text || text.length > batas) return ulang(`Tulis teks antara 1 dan ${batas} karakter.`);
      draft[field] = text;
    }

    const next = FLOW[type][FLOW[type].indexOf(field) + 1] ?? "confirm";
    await simpanState(`${type}:${next}`, draft);
    if (next === "confirm") return reply(ringkasanDraft(type, draft, zona), ["Simpan", "Koreksi", "Batal"]);
    return tanya(type, next);
  });
}
