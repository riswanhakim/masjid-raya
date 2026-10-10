import { z } from "zod";
import { tanggalKalender } from "./validasi";

/**
 * Perhitungan laporan kas. Sengaja dipisah dari akses database supaya
 * dashboard, ekspor, bot, dan TV memakai rumus yang sama dan bisa diuji.
 *
 * Tanggal transaksi disimpan sebagai tengah malam UTC dari tanggal kalender,
 * jadi perbandingan periode cukup memakai string YYYY-MM-DD.
 */

export interface BarisKas {
  id: string;
  tanggal: Date;
  jenis: string;
  jumlah: number;
  dana: string;
  kategori: string | null;
  keterangan: string;
}

export const filterKasSchema = z.object({
  dari: tanggalKalender,
  sampai: tanggalKalender,
  dana: z.string().trim().max(80).default(""),
  kategori: z.string().trim().max(80).default(""),
  jenis: z.enum(["", "masuk", "keluar"]).default(""),
  q: z.string().trim().max(100).default(""),
}).refine((f) => f.sampai >= f.dari, { message: "Tanggal akhir harus sama atau setelah tanggal awal", path: ["sampai"] });

export type FilterKas = z.infer<typeof filterKasSchema>;

export const TANPA_KATEGORI = "Tanpa kategori";

export function kunciHari(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 10);
}

/** Periode bawaan: awal bulan berjalan sampai hari ini, di zona masjid. */
export function periodeBulanIni(hariIni: string): { dari: string; sampai: string } {
  return { dari: `${hariIni.slice(0, 8)}01`, sampai: hariIni };
}

/** Baca filter dari query string; nilai yang tidak sah jatuh ke bawaan. */
export function bacaFilter(params: Record<string, string | undefined>, hariIni: string): { filter: FilterKas; galat: string | null } {
  const bawaan = periodeBulanIni(hariIni);
  const hasil = filterKasSchema.safeParse({
    dari: params.dari || bawaan.dari,
    sampai: params.sampai || bawaan.sampai,
    dana: params.dana ?? "",
    kategori: params.kategori ?? "",
    jenis: params.jenis ?? "",
    q: params.q ?? "",
  });
  if (hasil.success) return { filter: hasil.data, galat: null };
  return {
    filter: { ...bawaan, dana: "", kategori: "", jenis: "", q: "" },
    galat: hasil.error.issues[0]?.message ?? "Filter tidak valid",
  };
}

export interface LaporanKas {
  filter: FilterKas;
  /** Ringkasan saldo: hanya mengikuti periode dan dana. */
  ringkasan: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number };
  /** Baris yang lolos seluruh filter, terbaru di atas. */
  baris: BarisKas[];
  /** Subtotal baris hasil filter (bisa berbeda dari ringkasan saldo). */
  subtotal: { masuk: number; keluar: number; jumlahBaris: number };
  /** Rekap per bulan dalam periode dan dana yang dipilih. */
  bulanan: { bulan: string; masuk: number; keluar: number }[];
  /** Rincian per kategori dalam periode dan dana yang dipilih. */
  kategori: { jenis: "masuk" | "keluar"; kategori: string; total: number; jumlahBaris: number }[];
  /** Saldo akhir per dana pada akhir periode (tidak terpengaruh filter dana). */
  saldoPerDana: { dana: string; saldo: number }[];
  /** Filter pencarian/kategori/jenis aktif, sehingga daftar ≠ ringkasan. */
  daftarTersaring: boolean;
}

function bertanda(row: { jenis: string; jumlah: number }) {
  return row.jenis === "masuk" ? row.jumlah : -row.jumlah;
}

/** Hitung laporan dari baris transaksi aktif (yang dibatalkan sudah dibuang). */
export function hitungLaporan(rows: BarisKas[], filter: FilterKas): LaporanKas {
  const cocokDana = (r: BarisKas) => !filter.dana || r.dana === filter.dana;
  const q = filter.q.toLowerCase();
  const cocokDaftar = (r: BarisKas) =>
    (!filter.jenis || r.jenis === filter.jenis) &&
    (!filter.kategori || (r.kategori || TANPA_KATEGORI) === filter.kategori) &&
    (!q || r.keterangan.toLowerCase().includes(q) || (r.kategori ?? "").toLowerCase().includes(q));

  let saldoAwal = 0;
  let masuk = 0;
  let keluar = 0;
  const dalamPeriode: BarisKas[] = [];
  const perDana = new Map<string, number>();

  for (const r of rows) {
    const hari = kunciHari(r.tanggal);
    if (hari <= filter.sampai) perDana.set(r.dana, (perDana.get(r.dana) ?? 0) + bertanda(r));
    if (!cocokDana(r)) continue;
    if (hari < filter.dari) {
      saldoAwal += bertanda(r);
    } else if (hari <= filter.sampai) {
      dalamPeriode.push(r);
      if (r.jenis === "masuk") masuk += r.jumlah;
      else keluar += r.jumlah;
    }
  }

  const baris = dalamPeriode.filter(cocokDaftar).sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime() || b.id.localeCompare(a.id));
  const subtotal = { masuk: 0, keluar: 0, jumlahBaris: baris.length };
  for (const r of baris) {
    if (r.jenis === "masuk") subtotal.masuk += r.jumlah;
    else subtotal.keluar += r.jumlah;
  }

  const bulanan = new Map<string, { masuk: number; keluar: number }>();
  // Periode "seluruh catatan" dimulai dari tahun 0001; grafik cukup dimulai
  // dari bulan transaksi pertama agar tidak membuat ribuan bulan kosong.
  let bulanAwal = filter.dari.slice(0, 7);
  if (selisihBulan(bulanAwal, filter.sampai.slice(0, 7)) > 120) {
    bulanAwal = dalamPeriode.reduce((min, r) => (kunciHari(r.tanggal).slice(0, 7) < min ? kunciHari(r.tanggal).slice(0, 7) : min), filter.sampai.slice(0, 7));
  }
  for (let b = bulanAwal; b <= filter.sampai.slice(0, 7); b = bulanBerikut(b)) {
    bulanan.set(b, { masuk: 0, keluar: 0 });
  }
  const kategori = new Map<string, { jenis: "masuk" | "keluar"; kategori: string; total: number; jumlahBaris: number }>();
  for (const r of dalamPeriode) {
    const slot = bulanan.get(kunciHari(r.tanggal).slice(0, 7));
    if (slot) {
      if (r.jenis === "masuk") slot.masuk += r.jumlah;
      else slot.keluar += r.jumlah;
    }
    const jenis = r.jenis === "masuk" ? "masuk" : "keluar";
    const nama = r.kategori || TANPA_KATEGORI;
    const kunci = `${jenis}|${nama}`;
    const k = kategori.get(kunci) ?? { jenis, kategori: nama, total: 0, jumlahBaris: 0 };
    k.total += r.jumlah;
    k.jumlahBaris += 1;
    kategori.set(kunci, k);
  }

  return {
    filter,
    ringkasan: { saldoAwal, masuk, keluar, saldoAkhir: saldoAwal + masuk - keluar },
    baris,
    subtotal,
    bulanan: [...bulanan].map(([bulan, v]) => ({ bulan, ...v })),
    kategori: [...kategori.values()].sort((a, b) => (a.jenis === b.jenis ? b.total - a.total : a.jenis === "masuk" ? -1 : 1)),
    saldoPerDana: [...perDana].map(([dana, saldo]) => ({ dana, saldo })).sort((a, b) => a.dana.localeCompare(b.dana, "id")),
    daftarTersaring: Boolean(filter.jenis || filter.kategori || filter.q),
  };
}

function selisihBulan(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

function bulanBerikut(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const FORMAT_BULAN = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "short", year: "numeric" });
const FORMAT_HARI = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** "Sep 2026" dari "2026-09". */
export function labelBulan(bulan: string): string {
  return FORMAT_BULAN.format(new Date(`${bulan}-01T00:00:00Z`));
}

/** "1 September 2026" dari "2026-09-01". */
export function labelHari(hari: string): string {
  return FORMAT_HARI.format(new Date(`${hari}T00:00:00Z`));
}

export function labelPeriode(filter: { dari: string; sampai: string }): string {
  return filter.dari === filter.sampai ? labelHari(filter.dari) : `${labelHari(filter.dari)} s.d. ${labelHari(filter.sampai)}`;
}

/** Query string untuk tautan yang mempertahankan filter. */
export function queryFilter(filter: FilterKas, tambahan: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filter, ...tambahan })) if (v) params.set(k, String(v));
  return params.toString();
}
