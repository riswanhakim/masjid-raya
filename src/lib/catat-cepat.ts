/**
 * Pembaca catatan kas satu baris untuk bot Telegram, misalnya:
 *
 *   +300rb kotak jumat
 *   -150.000 listrik #pembangunan kemarin
 *   -1,5jt servis AC tgl 3
 *
 * "+" pemasukan, "-" pengeluaran (atau jenis bawaan dari menu). Dana ditulis
 * dengan "#", tanggal opsional (bawaan hari ini). Kategori diisi otomatis
 * bila nama kategori yang sudah ada muncul di keterangan.
 */

export const MAKS_NOMINAL = 2147483647;

export interface CatatanCepat {
  jenis: "masuk" | "keluar";
  jumlah: number;
  keterangan: string;
  dana: string;
  kategori: string | null;
  tanggal: string;
}

export type HasilBaca = { ok: true; catatan: CatatanCepat } | { ok: false; pesan: string };

interface Opsi {
  /** YYYY-MM-DD di zona masjid. */
  hariIni: string;
  /** Nama dana aktif, urutan pertama menjadi bawaan. */
  danaAktif: string[];
  /** Nama kategori yang sudah pernah dipakai. */
  kategori: string[];
  jenisBawaan?: "masuk" | "keluar";
}

const SATUAN: Record<string, number> = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6 };

/** "300rb" → 300000, "1,5jt" → 1500000, "300.000" → 300000, "Rp 50.000" → 50000. */
export function bacaNominal(token: string, satuanTerpisah?: string): number | null {
  const m = /^(?:rp\.?)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)?$/i.exec(token.trim());
  if (!m) return null;
  const satuan = (m[2] ?? satuanTerpisah ?? "").toLowerCase();
  const angka = m[1];
  let nilai: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(angka) && !satuan) {
    nilai = Number(angka.replace(/[.,]/g, ""));
  } else {
    nilai = Number(angka.replace(",", "."));
    if (satuan) nilai *= SATUAN[satuan];
  }
  nilai = Math.round(nilai);
  return Number.isFinite(nilai) && nilai > 0 ? nilai : null;
}

function geserHari(iso: string, hari: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

function tanggalSah(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
}

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function bacaCatatanCepat(teksMentah: string, opsi: Opsi): HasilBaca {
  let teks = teksMentah.trim().replace(/\s+/g, " ");
  let jenis = opsi.jenisBawaan;
  const tanda = /^([+-])\s*/.exec(teks);
  if (tanda) {
    jenis = tanda[1] === "+" ? "masuk" : "keluar";
    teks = teks.slice(tanda[0].length);
  }
  if (!jenis) return { ok: false, pesan: "Awali dengan + untuk pemasukan atau - untuk pengeluaran, misalnya: +300rb kotak jumat" };

  // Dana: #nama (cocok dengan awal nama dana, tanpa beda huruf dan spasi).
  let dana = opsi.danaAktif[0] ?? "";
  const tagar = /(?:^|\s)#([^\s#]+)/.exec(teks);
  if (tagar) {
    const cari = normal(tagar[1]);
    const cocok = opsi.danaAktif.filter((d) => normal(d).startsWith(cari));
    if (cocok.length !== 1) {
      return { ok: false, pesan: cocok.length ? `"#${tagar[1]}" cocok dengan lebih dari satu dana: ${cocok.join(", ")}.` : `Dana "#${tagar[1]}" tidak ada. Dana aktif: ${opsi.danaAktif.join(", ")}.` };
    }
    dana = cocok[0];
    teks = teks.replace(tagar[0], " ");
  }
  if (!dana) return { ok: false, pesan: "Belum ada dana aktif. Minta admin atau bendahara menambahkan dana di panel." };

  // Tanggal: hari ini, kemarin, tgl 5, 5/10, 5/10/2026, 2026-10-05.
  let tanggal = opsi.hariIni;
  const [ty, tm] = opsi.hariIni.split("-").map(Number);
  const polaTanggal: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [/(?:^|\s)hari ini(?=\s|$)/i, () => opsi.hariIni],
    [/(?:^|\s)kemarin(?=\s|$)/i, () => geserHari(opsi.hariIni, -1)],
    [/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/, (m) => tanggalSah(+m[1], +m[2], +m[3])],
    [/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?=\s|$)/, (m) => tanggalSah(m[3] ? +m[3] : ty, +m[2], +m[1])],
    [/(?:^|\s)(?:tgl\.?|tanggal)\s*(\d{1,2})(?=\s|$)/i, (m) => tanggalSah(ty, tm, +m[1])],
  ];
  for (const [pola, ubah] of polaTanggal) {
    const m = pola.exec(teks);
    if (!m) continue;
    const hasil = ubah(m);
    if (!hasil) return { ok: false, pesan: `Tanggal "${m[0].trim()}" tidak ada di kalender.` };
    tanggal = hasil;
    teks = teks.replace(m[0], " ");
    break;
  }
  if (tanggal > opsi.hariIni) return { ok: false, pesan: "Tanggal transaksi tidak boleh di masa depan." };

  // Nominal: token angka pertama, satuan boleh menempel atau dipisah spasi.
  const kata = teks.trim().split(" ").filter(Boolean);
  let jumlah: number | null = null;
  for (let i = 0; i < kata.length; i++) {
    const berikut = kata[i + 1]?.toLowerCase();
    const satuanTerpisah = berikut && berikut in SATUAN ? berikut : undefined;
    const tokenGabung = /^rp\.?$/i.test(kata[i]) && kata[i + 1] ? `${kata[i]}${kata[i + 1]}` : kata[i];
    const nilai = bacaNominal(tokenGabung, satuanTerpisah);
    if (nilai === null) continue;
    jumlah = nilai;
    const buang = (tokenGabung !== kata[i] ? 2 : 1) + (satuanTerpisah && tokenGabung === kata[i] ? 1 : 0);
    kata.splice(i, buang);
    break;
  }
  if (jumlah === null) return { ok: false, pesan: "Nominalnya belum terbaca. Contoh: +300rb kotak jumat, atau -150.000 listrik." };
  if (jumlah > MAKS_NOMINAL) return { ok: false, pesan: "Nominal maksimal Rp2.147.483.647 per transaksi." };

  let keterangan = kata.join(" ").trim();
  if (!keterangan) return { ok: false, pesan: "Tambahkan keterangannya, misalnya: +300rb kotak jumat." };
  if (keterangan.length > 200) return { ok: false, pesan: "Keterangan maksimal 200 karakter." };
  keterangan = keterangan[0].toUpperCase() + keterangan.slice(1);

  // Kategori: nama kategori terpanjang yang muncul di keterangan.
  const kecil = ` ${keterangan.toLowerCase()} `;
  const kategori = [...opsi.kategori]
    .sort((a, b) => b.length - a.length)
    .find((k) => k.trim() && kecil.includes(` ${k.toLowerCase()} `)) ?? null;

  return { ok: true, catatan: { jenis, jumlah, keterangan, dana, kategori, tanggal } };
}
