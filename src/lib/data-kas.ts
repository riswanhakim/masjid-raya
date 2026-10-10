import prisma from "./prisma";
import { getPetaPengaturan } from "./settings";
import { normalisasiLokasi } from "./kota";
import { nilaiInputTanggal } from "./format";
import { hitungLaporan, labelPeriode, periodeBulanIni, type FilterKas } from "./laporan-kas";

/** Akses database untuk laporan kas. Rumusnya ada di laporan-kas.ts. */

export async function zonaMasjid() {
  const pengaturan = await getPetaPengaturan();
  return normalisasiLokasi(pengaturan.lokasi_default).zona;
}

export async function hariIniMasjid() {
  return nilaiInputTanggal(new Date(), await zonaMasjid());
}

/** Transaksi aktif sampai tanggal akhir filter (yang lebih awal perlu untuk saldo awal). */
export async function barisKasAktif(sampai: string) {
  return prisma.kasTransaksi.findMany({
    where: { deletedAt: null, tanggal: { lte: new Date(`${sampai}T00:00:00.000Z`) } },
    select: { id: true, tanggal: true, jenis: true, jumlah: true, dana: true, kategori: true, keterangan: true, pencatatId: true, sumber: true, bukti: true, createdAt: true },
  });
}

export async function muatLaporan(filter: FilterKas) {
  const rows = await barisKasAktif(filter.sampai);
  const laporan = hitungLaporan(rows, filter);
  const ids = new Set(laporan.baris.map((b) => b.id));
  const detail = new Map(rows.filter((r) => ids.has(r.id)).map((r) => [r.id, r]));
  const pencatatIds = [...new Set([...detail.values()].map((r) => r.pencatatId).filter((v): v is string => !!v))];
  const pencatat = new Map(
    (await prisma.user.findMany({ where: { id: { in: pencatatIds } }, select: { id: true, name: true, email: true } }))
      .map((u) => [u.id, u.name || u.email])
  );
  return {
    ...laporan,
    baris: laporan.baris.map((b) => {
      const d = detail.get(b.id)!;
      return { ...b, sumber: d.sumber, bukti: d.bukti, pencatat: d.pencatatId ? pencatat.get(d.pencatatId) ?? "Akun dihapus" : "Tidak tercatat", dicatatPada: d.createdAt };
    }),
  };
}

export type LaporanLengkap = Awaited<ReturnType<typeof muatLaporan>>;

export async function daftarDana(hanyaAktif = false) {
  return prisma.dana.findMany({ where: hanyaAktif ? { aktif: true } : undefined, orderBy: [{ urutan: "asc" }, { nama: "asc" }] });
}

export async function daftarKategori() {
  const rows = await prisma.kasTransaksi.findMany({ where: { deletedAt: null, kategori: { not: null } }, distinct: ["kategori"], select: { kategori: true } });
  return rows.map((r) => r.kategori!).filter(Boolean).sort((a, b) => a.localeCompare(b, "id"));
}

/**
 * Cocokkan nama dana kiriman pengguna dengan daftar dana aktif tanpa
 * membedakan huruf besar-kecil. Mengembalikan ejaan resmi, atau null.
 */
export async function danaResmi(nama: string, db: Pick<typeof prisma, "dana"> = prisma) {
  const bersih = nama.trim().toLowerCase();
  const semua = await db.dana.findMany({ where: { aktif: true } });
  return semua.find((d) => d.nama.toLowerCase() === bersih)?.nama ?? null;
}

/* ----------------------------- Publikasi kas ---------------------------- */

export type PeriodePublik = "bulan_ini" | "tahun_ini" | "semua";

export interface RingkasanPublik {
  periode: string;
  dari: string | null;
  sampai: string;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  saldoAkhir: number;
  dana: { nama: string; saldo: number }[];
}

/**
 * Ringkasan kas yang boleh dilihat jamaah, atau null bila admin belum
 * mengaktifkan publikasi. Respons hanya berisi angka agregat: tanpa
 * keterangan, bukti, pencatat, atau identitas donor.
 */
export async function ringkasanKasPublik(): Promise<RingkasanPublik | null> {
  const pengaturan = await getPetaPengaturan();
  if (pengaturan.kas_publik !== "true") return null;
  const zona = normalisasiLokasi(pengaturan.lokasi_default).zona;
  const hariIni = nilaiInputTanggal(new Date(), zona);
  const periode = (["bulan_ini", "tahun_ini", "semua"].includes(pengaturan.kas_publik_periode) ? pengaturan.kas_publik_periode : "bulan_ini") as PeriodePublik;
  const dariPeriode = periode === "bulan_ini" ? periodeBulanIni(hariIni).dari : periode === "tahun_ini" ? `${hariIni.slice(0, 4)}-01-01` : "0001-01-01";
  const danaDipilih = pengaturan.kas_publik_dana.split("\n").map((s) => s.trim()).filter(Boolean);

  const rows = (await barisKasAktif(hariIni)).filter((r) => danaDipilih.length === 0 || danaDipilih.includes(r.dana));
  const lap = hitungLaporan(rows, { dari: dariPeriode, sampai: hariIni, dana: "", kategori: "", jenis: "", q: "" });
  return {
    periode: periode === "semua" ? "Seluruh catatan" : labelPeriode({ dari: dariPeriode, sampai: hariIni }),
    dari: periode === "semua" ? null : dariPeriode,
    sampai: hariIni,
    ...lap.ringkasan,
    dana: lap.saldoPerDana.map((d) => ({ nama: d.dana, saldo: d.saldo })),
  };
}
