import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LaporanLengkap } from "./data-kas";
import { labelBulan, labelPeriode } from "./laporan-kas";

/**
 * Ekspor laporan kas ke Excel dan PDF. Angka diambil dari objek laporan yang
 * sama dengan dashboard sehingga total di berkas selalu cocok dengan panel.
 */

export interface MetaEkspor {
  namaMasjid: string;
  alamat: string | null;
  dibuatPada: string;
  dibuatOleh: string;
}

function rupiah(n: number) {
  return `${n < 0 ? "-" : ""}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(n))}`;
}

function cakupan(lap: LaporanLengkap) {
  const f = lap.filter;
  const saringan = [
    f.jenis && `jenis ${f.jenis === "masuk" ? "pemasukan" : "pengeluaran"}`,
    f.kategori && `kategori "${f.kategori}"`,
    f.q && `pencarian "${f.q}"`,
  ].filter(Boolean);
  return {
    periode: labelPeriode(f),
    dana: f.dana || "Semua dana",
    saringan: saringan.length ? saringan.join(", ") : "Tanpa saringan tambahan",
  };
}

export function namaBerkas(lap: LaporanLengkap, ekstensi: string) {
  const dana = lap.filter.dana ? `-${lap.filter.dana.replace(/[^A-Za-z0-9]+/g, "-")}` : "";
  return `laporan-kas-${lap.filter.dari}-sd-${lap.filter.sampai}${dana}.${ekstensi}`;
}

/* --------------------------------- Excel -------------------------------- */

export async function buatExcel(lap: LaporanLengkap, meta: MetaEkspor): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.namaMasjid;
  wb.created = new Date();
  const c = cakupan(lap);
  const formatRp = '"Rp"#,##0;[Red]-"Rp"#,##0';

  const ws = wb.addWorksheet("Ringkasan");
  ws.columns = [{ width: 34 }, { width: 26 }, { width: 14 }];
  ws.addRow([meta.namaMasjid]).font = { bold: true, size: 14 };
  if (meta.alamat) ws.addRow([meta.alamat]);
  ws.addRow(["Laporan Kas"]).font = { bold: true, size: 12 };
  ws.addRow([]);
  ws.addRow(["Periode", c.periode]);
  ws.addRow(["Dana", c.dana]);
  ws.addRow(["Saringan daftar transaksi", c.saringan]);
  ws.addRow(["Dibuat pada", meta.dibuatPada]);
  ws.addRow(["Dibuat oleh", meta.dibuatOleh]);
  ws.addRow([]);
  ws.addRow(["Ringkasan saldo (periode dan dana)"]).font = { bold: true };
  for (const [label, nilai] of [
    ["Saldo awal periode", lap.ringkasan.saldoAwal],
    ["Pemasukan periode", lap.ringkasan.masuk],
    ["Pengeluaran periode", lap.ringkasan.keluar],
    ["Saldo akhir periode", lap.ringkasan.saldoAkhir],
  ] as const) {
    const row = ws.addRow([label, nilai]);
    row.getCell(2).numFmt = formatRp;
  }
  ws.addRow([]);
  ws.addRow(["Rincian per kategori", "Total", "Transaksi"]).font = { bold: true };
  for (const k of lap.kategori) {
    const row = ws.addRow([`${k.jenis === "masuk" ? "Masuk" : "Keluar"}: ${k.kategori}`, k.total, k.jumlahBaris]);
    row.getCell(2).numFmt = formatRp;
  }
  ws.addRow([]);
  ws.addRow(["Rekap bulanan", "Pemasukan", "Pengeluaran"]).font = { bold: true };
  for (const b of lap.bulanan) {
    const row = ws.addRow([labelBulan(b.bulan), b.masuk, b.keluar]);
    row.getCell(2).numFmt = formatRp;
    row.getCell(3).numFmt = formatRp;
  }

  const wt = wb.addWorksheet("Transaksi");
  wt.columns = [
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Keterangan", key: "keterangan", width: 40 },
    { header: "Dana", key: "dana", width: 16 },
    { header: "Kategori", key: "kategori", width: 20 },
    { header: "Pemasukan", key: "masuk", width: 16 },
    { header: "Pengeluaran", key: "keluar", width: 16 },
    { header: "Pencatat", key: "pencatat", width: 22 },
    { header: "Sumber", key: "sumber", width: 10 },
    { header: "Bukti", key: "bukti", width: 8 },
  ];
  wt.getRow(1).font = { bold: true };
  for (const b of lap.baris) {
    wt.addRow({
      tanggal: b.tanggal,
      keterangan: b.keterangan,
      dana: b.dana,
      kategori: b.kategori ?? "",
      masuk: b.jenis === "masuk" ? b.jumlah : null,
      keluar: b.jenis === "keluar" ? b.jumlah : null,
      pencatat: b.pencatat,
      sumber: b.sumber === "telegram" ? "Telegram" : "Panel",
      bukti: b.bukti ? "Ada" : "",
    });
  }
  const total = wt.addRow({ keterangan: `Subtotal ${lap.subtotal.jumlahBaris} transaksi`, masuk: lap.subtotal.masuk, keluar: lap.subtotal.keluar });
  total.font = { bold: true };
  wt.getColumn("tanggal").numFmt = "dd/mm/yyyy";
  wt.getColumn("masuk").numFmt = formatRp;
  wt.getColumn("keluar").numFmt = formatRp;
  wt.views = [{ state: "frozen", ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------------------------------- PDF --------------------------------- */

// Font bawaan PDF hanya mengenal WinAnsi; karakter lain diganti tanda tanya
// agar pembuatan berkas tidak gagal karena satu huruf asing.
const KHUSUS = new Set("‘’“”–—…€•".split(""));
function aman(teks: string) {
  return [...teks].map((ch) => {
    const k = ch.codePointAt(0)!;
    return (k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) || KHUSUS.has(ch) ? ch : "?";
  }).join("");
}

function potong(teks: string, font: PDFFont, ukuran: number, lebar: number) {
  let t = aman(teks);
  if (font.widthOfTextAtSize(t, ukuran) <= lebar) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, ukuran) > lebar) t = t.slice(0, -1);
  return `${t}...`;
}

export async function buatPdf(lap: LaporanLengkap, meta: MetaEkspor): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Laporan Kas ${meta.namaMasjid}`);
  doc.setCreator(meta.namaMasjid);
  const biasa = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const hijau = rgb(0.03, 0.24, 0.16);
  const abu = rgb(0.23, 0.35, 0.29);
  const garis = rgb(0.8, 0.86, 0.83);
  const L = 595.28, T = 841.89, M = 40;
  const c = cakupan(lap);

  let page: PDFPage = doc.addPage([L, T]);
  let y = T - M;
  const tulis = (teks: string, x: number, opsi: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; kanan?: number } = {}) => {
    const font = opsi.font ?? biasa;
    const size = opsi.size ?? 9;
    const t = aman(teks);
    const xx = opsi.kanan !== undefined ? opsi.kanan - font.widthOfTextAtSize(t, size) : x;
    page.drawText(t, { x: xx, y, font, size, color: opsi.color ?? rgb(0.03, 0.14, 0.1) });
  };

  tulis(meta.namaMasjid, M, { font: tebal, size: 16, color: hijau });
  y -= 16;
  if (meta.alamat) { tulis(meta.alamat, M, { color: abu }); y -= 14; }
  y -= 6;
  tulis("Laporan Kas", M, { font: tebal, size: 13 });
  y -= 20;
  for (const [label, nilai] of [["Periode", c.periode], ["Dana", c.dana], ["Daftar transaksi", c.saringan], ["Dibuat", `${meta.dibuatPada} oleh ${meta.dibuatOleh}`]]) {
    tulis(label, M, { color: abu });
    tulis(potong(nilai, biasa, 9, L - M * 2 - 110), M + 110);
    y -= 13;
  }

  y -= 10;
  page.drawRectangle({ x: M, y: y - 52, width: L - M * 2, height: 62, color: rgb(0.92, 0.98, 0.95), borderColor: garis, borderWidth: 0.5 });
  const kolom = (L - M * 2) / 4;
  const ringkas: [string, number][] = [
    ["Saldo awal", lap.ringkasan.saldoAwal],
    ["Pemasukan", lap.ringkasan.masuk],
    ["Pengeluaran", lap.ringkasan.keluar],
    ["Saldo akhir", lap.ringkasan.saldoAkhir],
  ];
  ringkas.forEach(([label, nilai], i) => {
    const x = M + 12 + kolom * i;
    page.drawText(label, { x, y: y - 8, font: biasa, size: 8, color: abu });
    page.drawText(rupiah(nilai), { x, y: y - 26, font: tebal, size: 11, color: hijau });
  });
  y -= 76;

  // Tabel transaksi
  const kol = [
    { judul: "Tanggal", lebar: 58 },
    { judul: "Keterangan", lebar: 160 },
    { judul: "Dana", lebar: 70 },
    { judul: "Kategori", lebar: 80 },
    { judul: "Masuk", lebar: 73, kanan: true },
    { judul: "Keluar", lebar: 73, kanan: true },
  ];
  const kepala = () => {
    let x = M;
    page.drawLine({ start: { x: M, y: y + 12 }, end: { x: L - M, y: y + 12 }, thickness: 0.5, color: garis });
    for (const k of kol) {
      tulis(k.judul, x, { font: tebal, size: 8, color: abu, kanan: k.kanan ? x + k.lebar - 4 : undefined });
      x += k.lebar;
    }
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: L - M, y }, thickness: 0.5, color: garis });
    y -= 12;
  };
  const halamanBaru = () => {
    page = doc.addPage([L, T]);
    y = T - M;
    kepala();
  };

  tulis(`Daftar transaksi (${lap.subtotal.jumlahBaris})`, M, { font: tebal, size: 10 });
  y -= 22;
  kepala();
  if (lap.baris.length === 0) {
    tulis("Tidak ada transaksi pada cakupan ini.", M, { color: abu });
    y -= 14;
  }
  for (const b of lap.baris) {
    if (y < M + 40) halamanBaru();
    const sel = [
      b.tanggal.toISOString().slice(0, 10).split("-").reverse().join("/"),
      b.keterangan,
      b.dana,
      b.kategori ?? "",
      b.jenis === "masuk" ? rupiah(b.jumlah) : "",
      b.jenis === "keluar" ? rupiah(b.jumlah) : "",
    ];
    let x = M;
    sel.forEach((isi, i) => {
      const k = kol[i];
      tulis(potong(isi, biasa, 8, k.lebar - 6), x, { size: 8, kanan: k.kanan ? x + k.lebar - 4 : undefined });
      x += k.lebar;
    });
    y -= 14;
  }
  if (y < M + 40) halamanBaru();
  page.drawLine({ start: { x: M, y: y + 10 }, end: { x: L - M, y: y + 10 }, thickness: 0.5, color: garis });
  y -= 2;
  const xMasuk = M + kol.slice(0, 5).reduce((s, k) => s + k.lebar, 0) - 4;
  const xKeluar = xMasuk + kol[5].lebar;
  tulis("Subtotal", M, { font: tebal, size: 8 });
  tulis(rupiah(lap.subtotal.masuk), 0, { font: tebal, size: 8, kanan: xMasuk });
  tulis(rupiah(lap.subtotal.keluar), 0, { font: tebal, size: 8, kanan: xKeluar });

  const halaman = doc.getPages();
  halaman.forEach((p, i) => {
    const teks = `${aman(meta.namaMasjid)} - Laporan Kas - Halaman ${i + 1} dari ${halaman.length}`;
    p.drawText(teks, { x: M, y: 20, font: biasa, size: 7, color: abu });
  });

  return doc.save();
}
